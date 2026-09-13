"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/auth";
export type PublishState = { error?: string; reportId?: string };
export async function publishReport(
  _: PublishState,
  form: FormData,
): Promise<PublishState> {
  const parsed = z
    .object({
      campaign_id: z.uuid(),
      password: z
        .string()
        .min(12)
        .max(64)
        .refine(
          (v) => new TextEncoder().encode(v).length <= 64 && !v.includes("\0"),
        ),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      error:
        "Use at least 12 characters, up to 64 UTF-8 bytes, for the report password.",
    };
  const { supabase, membership } = await requireMembership();
  if (membership.role !== "owner")
    return { error: "Only your brand owner can publish a report." };
  const { data, error } = await supabase.rpc("publish_report", {
    p_campaign_id: parsed.data.campaign_id,
    p_password: parsed.data.password,
  });
  if (error || !data)
    return { error: "The report could not be published. Please try again." };
  revalidatePath(`/campaigns/${parsed.data.campaign_id}`);
  return { reportId: data };
}
export async function revokeReport(
  _: PublishState,
  form: FormData,
): Promise<PublishState> {
  const parsed = z
    .object({ campaign_id: z.uuid(), report_id: z.uuid() })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Select a valid report." };
  const { supabase, membership } = await requireMembership();
  if (membership.role !== "owner")
    return { error: "Only your brand owner can revoke a report." };
  const { data: report, error: readError } = await supabase
    .from("shared_reports")
    .select("campaign_id")
    .eq("id", parsed.data.report_id)
    .maybeSingle();
  if (readError || report?.campaign_id !== parsed.data.campaign_id)
    return { error: "This report is unavailable." };
  const { error } = await supabase.rpc("revoke_report", {
    p_report_id: parsed.data.report_id,
  });
  if (error)
    return { error: "The report could not be revoked. Please try again." };
  revalidatePath(`/campaigns/${parsed.data.campaign_id}`);
  return {};
}
