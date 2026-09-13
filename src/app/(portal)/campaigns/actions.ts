"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMembership } from "@/lib/auth";
export type CampaignActionState = { error?: string };
const safeErrors = [
  "Preview was replaced. Review a new audience.",
  "Preview expired. Refresh the audience before approving.",
  "Contactability changed. Refresh and review the audience again.",
  "Approval count does not match the saved audience",
];
export async function prepareCampaign(
  _: CampaignActionState,
  form: FormData,
): Promise<CampaignActionState> {
  const parsed = z.uuid().safeParse(form.get("campaign_id"));
  if (!parsed.success) return { error: "Select a valid campaign." };
  const { supabase, membership } = await requireMembership();
  if (membership.role !== "owner")
    return { error: "Only an owner can prepare a send." };
  const { data, error } = await supabase.rpc("prepare_campaign", {
    p_campaign_id: parsed.data,
    p_refresh: form.get("refresh") === "true",
  });
  if (error || !data)
    return { error: "The audience could not be prepared. Please try again." };
  redirect(`/campaigns/${parsed.data}/send/${data}`);
}
export async function confirmCampaign(
  _: CampaignActionState,
  form: FormData,
): Promise<CampaignActionState> {
  const parsed = z
    .object({
      campaign_id: z.uuid(),
      approval_id: z.uuid(),
      count: z.coerce.number().int().positive(),
      hash: z.string().regex(/^[a-f0-9]{32}$/),
      acknowledged: z.literal("yes"),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { error: "Confirm that you have reviewed the saved audience." };
  const { supabase, membership } = await requireMembership();
  if (membership.role !== "owner")
    return { error: "Only an owner can approve a send." };
  const { data: approval, error: readError } = await supabase
    .from("campaign_approvals")
    .select("campaign_id")
    .eq("id", parsed.data.approval_id)
    .maybeSingle();
  if (readError || approval?.campaign_id !== parsed.data.campaign_id)
    return {
      error:
        "This audience is unavailable. Return to the campaign and prepare it again.",
    };
  const { data, error } = await supabase.rpc("confirm_campaign", {
    p_approval_id: parsed.data.approval_id,
    p_count: parsed.data.count,
    p_hash: parsed.data.hash,
  });
  if (error)
    return {
      error: safeErrors.includes(error.message)
        ? error.message
        : "Approval could not be verified. Reload this page to check its status before trying again.",
    };
  revalidatePath(`/campaigns/${parsed.data.campaign_id}`);
  redirect(`/campaigns/${parsed.data.campaign_id}/send/${data}`);
}
export async function retryCampaign(
  _: CampaignActionState,
  form: FormData,
): Promise<CampaignActionState> {
  const id = z.uuid().safeParse(form.get("approval_id"));
  if (!id.success) return { error: "Select a valid approval." };
  const { supabase, membership } = await requireMembership();
  if (membership.role !== "owner")
    return { error: "Only an owner can resume a send." };
  const { data: approval, error: readError } = await supabase
    .from("campaign_approvals")
    .select("campaign_id")
    .eq("id", id.data)
    .maybeSingle();
  if (readError || !approval) return { error: "This approval is unavailable." };
  const { error } = await supabase.rpc("retry_campaign", {
    p_approval_id: id.data,
  });
  if (error)
    return {
      error:
        "The retry could not be queued. Reload to check the current status.",
    };
  revalidatePath(`/campaigns/${approval.campaign_id}`);
  revalidatePath(`/campaigns/${approval.campaign_id}/send/${id.data}`);
  return {};
}
