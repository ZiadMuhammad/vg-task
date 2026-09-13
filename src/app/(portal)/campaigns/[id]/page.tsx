import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CheckCheck,
  Info,
  Mail,
  MousePointer2,
  Send,
  ShieldAlert,
  UserMinus,
} from "lucide-react";
import { z } from "zod";
import { requireMembership } from "@/lib/auth";
import { PageHeading } from "@/components/page-heading";
import { MetricCard } from "@/components/metric-card";
import { Badge } from "@/components/ui/badge";
import { campaignSchema, day, percentage } from "@/lib/campaigns/metrics";
import { number } from "@/lib/utils";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase } = await requireMembership();
  const { data, error } = await supabase
    .from("campaign_metrics")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Campaign unavailable");
  if (!data) notFound();
  const campaign = campaignSchema.parse(data);
  const { data: logs, error: logError } = await supabase
    .from("historical_sends")
    .select("batch_key,queued_at,recipient_count,status")
    .eq("campaign_id", id)
    .order("queued_at");
  if (logError) throw new Error("Historical send records unavailable");
  return (
    <>
      <Link
        href="/campaigns"
        className="mb-6 inline-block text-sm text-teal-700"
      >
        ← All campaigns
      </Link>
      <PageHeading
        eyebrow={campaign.external_id}
        title={campaign.name}
        description={`Historical report · ${day(campaign.sent_at)} UTC · Target: ${campaign.target_country ?? "all countries"}`}
      >
        <Badge>
          {campaign.channel === "email" ? "Email campaign" : "SMS campaign"}
        </Badge>
      </PageHeading>
      <div className="mb-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Send}
          label="Reported sent"
          value={campaign.reported_sent}
          detail="Source campaign export"
        />
        <MetricCard
          icon={CheckCheck}
          label="Reported delivered"
          value={campaign.reported_delivered}
          detail={`${percentage(campaign.reported_delivered, campaign.reported_sent)} of reported sent`}
        />
        <MetricCard
          icon={ShieldAlert}
          label="Reported bounced"
          value={campaign.reported_bounced}
          detail="Source total; not inferred from the raw log"
        />
        <MetricCard
          icon={Mail}
          label="Reported opens"
          value={campaign.reported_opens}
          detail="Source event count; may contain repeat opens"
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold">Observed engagement</h2>
          <p className="mt-2 text-xs leading-6 text-slate-500">
            Distinct customer IDs in correctly attributed raw events. A customer
            can appear in several event types. These counts describe observed
            events, not the full historical audience.
          </p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {[
              {
                label: "Unique opens",
                value:
                  campaign.channel === "email"
                    ? number.format(campaign.observed_unique_opens)
                    : "Not applicable",
                icon: Mail,
              },
              {
                label: "Unique clicks",
                value: number.format(campaign.observed_unique_clicks),
                icon: MousePointer2,
              },
              {
                label: "Unique unsubscribes",
                value: number.format(campaign.observed_unique_unsubscribes),
                icon: UserMinus,
              },
              {
                label: "Unique complaints",
                value: number.format(campaign.observed_unique_complaints),
                icon: ShieldAlert,
              },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-lg bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Icon className="size-4" />
                  {label}
                </div>
                <p className="mt-3 text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs leading-6 text-slate-500">
            {number.format(campaign.observed_events)} valid raw events ·{" "}
            {number.format(campaign.observed_unique_bounces)} customers with
            observed bounces · {number.format(campaign.unattributed_events)}{" "}
            linked events excluded because their channel does not match.
          </p>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold">Campaign context</h2>
          <dl className="mt-6 space-y-5 text-sm">
            <div>
              <dt className="text-xs text-slate-400">
                Audience for a new send
              </dt>
              <dd className="mt-2 leading-6">
                Currently contactable{" "}
                {campaign.channel === "email" ? "email" : "SMS"} destinations
                {campaign.target_country
                  ? ` in ${campaign.target_country}`
                  : " in all countries"}
                , deduplicated before approval.
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Source spend</dt>
              <dd className="mt-2 font-medium">
                {(campaign.spend_minor / 100).toLocaleString("en-GB", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </dd>
              <dd className="mt-1 text-xs text-slate-400">
                Currency was not specified in the export.
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">
                Source parent reference
              </dt>
              <dd className="mt-2">{campaign.parent_external_id ?? "None"}</dd>
              <dd className="mt-1 text-xs text-slate-400">
                Source label only; no audience or results inherited.
              </dd>
            </div>
          </dl>
        </section>
      </div>
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold">Imported send log</h2>
        <p className="mt-2 text-xs leading-6 text-slate-500">
          Historical batch records, deduplicated by batch key. These exports do
          not contain an approved recipient snapshot.
        </p>
        {logs.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-400">
                <tr>
                  {["Batch", "Queued (UTC)", "Recipients", "Source status"].map(
                    (text) => (
                      <th key={text} className="py-3 pr-5 font-medium">
                        {text}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.batch_key} className="border-t border-slate-100">
                    <td className="py-4 pr-5 font-mono text-xs">
                      {log.batch_key}
                    </td>
                    <td className="py-4 pr-5">{day(log.queued_at)}</td>
                    <td className="py-4 pr-5">
                      {number.format(log.recipient_count)}
                    </td>
                    <td className="py-4">
                      <Badge>{log.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-5 text-sm text-slate-500">
            No batch log was supplied for this campaign.
          </p>
        )}
      </section>
      <div className="mt-6 flex gap-2 text-xs leading-6 text-slate-500">
        <Info className="mt-1 size-4 shrink-0" />
        <p>
          Reported opens can exceed delivered messages because the source does
          not promise unique opens. We show the source count and the observed
          unique count separately. A dash means the denominator is zero; SMS
          open rates are not calculated.
        </p>
      </div>
    </>
  );
}
