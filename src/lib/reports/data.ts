import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import { createReportClient } from "@/lib/supabase/admin";
import { verifyReportSession } from "./session";
const count = z.number().int().nonnegative();
export const reportSchema = z
  .object({
    campaign_name: z.string(),
    brand_name: z.string(),
    channel: z.enum(["email", "sms"]),
    historical_date: z.string(),
    reported: z
      .object({
        sent: count,
        delivered: count,
        bounced: count,
        opens: count,
        clicks: count,
      })
      .strict(),
    observed: z
      .object({
        opens: count,
        clicks: count,
        unsubscribes: count,
        bounces: count,
      })
      .strict(),
    live: z
      .object({
        approved_at: z.string(),
        approved: count,
        accepted: count,
        queued: count,
        rejected: count,
        withheld: count,
        delivered: count,
        bounced: count,
        opens: count,
        unsubscribed: count,
        last_synced_at: z.string().nullable(),
      })
      .strict()
      .nullable(),
  })
  .strict();
export function reportSecret() {
  const value = process.env.SHARE_SESSION_SECRET;
  if (!value) throw new Error("Report service unavailable");
  return value;
}
export async function loadSharedReport(id: string) {
  const cookie = (await cookies()).get("vg_report_session")?.value;
  const session = verifyReportSession(cookie, id, reportSecret(), Date.now());
  if (!session) return null;
  const { data, error } = await createReportClient().rpc(
    "read_shared_report",
    { p_report_id: id, p_version: session.version },
    { get: true },
  );
  if (error) throw new Error("The shared report could not be loaded");
  return data ? reportSchema.parse(data) : null;
}
