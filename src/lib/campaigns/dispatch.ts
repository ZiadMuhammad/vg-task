import { z } from "zod";
const count = z.number().int().nonnegative();
export const dispatchSchema = z.object({
  expired: z.boolean(),
  id: z.uuid(),
  campaign_id: z.uuid(),
  campaign_name: z.string(),
  channel: z.enum(["email", "sms"]),
  target_country: z.string().nullable(),
  prepared_at: z.string(),
  expires_at: z.string(),
  approved_at: z.string().nullable(),
  approved_by: z.uuid().nullable(),
  audience_hash: z.string(),
  recipient_count: count,
  queued: count,
  accepted: count,
  rejected: count,
  withheld: count,
  delivered: count,
  bounced: count,
  opened: count,
  unsubscribed: count,
  attention_batches: count,
  pending_batches: count,
  last_synced_at: z.string().nullable(),
  issue_count: count,
});
export type Dispatch = z.infer<typeof dispatchSchema>;
export function timestamp(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(new Date(value)) + " UTC"
    : "Not yet recorded";
}
