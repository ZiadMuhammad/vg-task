import { z } from "zod";

export const campaignSchema = z.object({
  id: z.string(),
  brand_id: z.string(),
  external_id: z.string(),
  name: z.string(),
  channel: z.enum(["email", "sms"]),
  target_country: z.string().nullable(),
  reported_sent: z.number(),
  reported_delivered: z.number(),
  reported_bounced: z.number(),
  reported_opens: z.number(),
  reported_clicks: z.number(),
  spend_minor: z.number(),
  sent_at: z.string(),
  parent_external_id: z.string().nullable(),
  observed_events: z.number(),
  observed_unique_opens: z.number(),
  observed_unique_clicks: z.number(),
  observed_unique_bounces: z.number(),
  observed_unique_unsubscribes: z.number(),
  observed_unique_complaints: z.number(),
  unattributed_events: z.number(),
});
export type Campaign = z.infer<typeof campaignSchema>;
export function percentage(numerator: number, denominator: number): string {
  return denominator > 0
    ? `${((numerator / denominator) * 100).toFixed(1)}%`
    : "—";
}
export const day = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
