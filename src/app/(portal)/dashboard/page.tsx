import Link from "next/link";
import {
  ArrowRight,
  ContactRound,
  Info,
  Send,
  UserPlus,
  Users,
} from "lucide-react";
import { z } from "zod";
import { requireMembership } from "@/lib/auth";
import { PageHeading } from "@/components/page-heading";
import { MetricCard } from "@/components/metric-card";
import { SignupChart } from "@/components/signup-chart";
import { CampaignTable } from "@/components/campaign-table";
import { Button } from "@/components/ui/button";
import { campaignSchema } from "@/lib/campaigns/metrics";
import { number } from "@/lib/utils";

const summarySchema = z.object({
  totals: z.object({
    customers: z.number(),
    contactable: z.number(),
    email_contactable: z.number(),
    sms_contactable: z.number(),
    deleted: z.number(),
    unknown_signup: z.number(),
  }),
  signups: z.array(z.object({ day: z.string(), signups: z.number() })),
  campaigns: z.number(),
  import_problems: z.number(),
  incomplete_imports: z.number(),
  unattributed_events: z.number(),
  as_of: z.string(),
});
export default async function DashboardPage() {
  const { supabase, brand } = await requireMembership();
  const [summaryResult, campaignResult] = await Promise.all([
    supabase.rpc("dashboard_summary"),
    supabase
      .from("campaign_metrics")
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(5),
  ]);
  if (summaryResult.error || campaignResult.error)
    throw new Error("Dashboard metrics unavailable");
  const summary = summarySchema.parse(summaryResult.data);
  const campaigns = campaignSchema.array().parse(campaignResult.data);
  const signups = summary.signups.reduce((sum, day) => sum + day.signups, 0);
  return (
    <>
      <PageHeading
        eyebrow={brand.name}
        title="Your growth, at a glance."
        description="Customers, reachability and campaign results in one place."
      >
        <Button asChild variant="secondary">
          <Link href="/campaigns">
            View campaigns
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </PageHeading>
      {summary.incomplete_imports > 0 && (
        <div
          role="status"
          className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          {summary.incomplete_imports} import(s) are incomplete. These numbers
          reflect the data loaded so far.{" "}
          <Link href="/imports" className="font-semibold underline">
            View import progress
          </Link>
        </div>
      )}
      <div className="mb-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Users}
          label="Total customers"
          value={summary.totals.customers}
          detail="Unique customer IDs, excluding deleted records"
        />
        <MetricCard
          icon={ContactRound}
          label="Contactable customers"
          value={summary.totals.contactable}
          detail="Can receive email, SMS, or both; counted once"
        />
        <MetricCard
          icon={UserPlus}
          label="Signups · last 30 days"
          value={signups}
          detail="Current customer signup dates, including today (UTC)"
        />
        <MetricCard
          icon={Send}
          label="Campaigns"
          value={summary.campaigns}
          detail="Distinct imported campaigns in your brand"
        />
      </div>
      <div className="mb-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">New customer signups</h2>
              <p className="mt-1 text-xs text-slate-400">
                The last 30 calendar days · UTC
              </p>
            </div>
            <span className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-500">
              {summary.signups[0]?.day} — {summary.signups.at(-1)?.day}
            </span>
          </div>
          <SignupChart data={summary.signups} />
          <details className="mt-4 text-xs text-slate-500">
            <summary className="cursor-pointer">
              View daily numbers and counting rules
            </summary>
            <p className="my-3 leading-5">
              One signup per current non-deleted customer ID. Date-only values
              use midnight UTC. {number.format(summary.totals.unknown_signup)}{" "}
              customer(s) have no reliable signup date and are excluded.
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
              {summary.signups.map((day) => (
                <div
                  key={day.day}
                  className="flex justify-between gap-2 border-b border-slate-100 pb-1"
                >
                  <span>{day.day}</span>
                  <span>{number.format(day.signups)}</span>
                </div>
              ))}
            </div>
          </details>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold">Ready to reach</h2>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Valid destinations and current permission.
          </p>
          <div className="mt-7 space-y-6">
            {[
              ["Email", summary.totals.email_contactable],
              ["SMS", summary.totals.sms_contactable],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="mb-3 flex justify-between gap-2 text-sm">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-semibold">
                    {number.format(Number(value))}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-teal-600"
                    style={{
                      width: `${summary.totals.customers ? (Number(value) / summary.totals.customers) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs leading-5 text-slate-400">
            A customer can appear in both channels. Sending also deduplicates
            shared destinations.
          </p>
          <Link
            href="/contacts"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-teal-700"
          >
            Explore customers
            <ArrowRight className="size-4" />
          </Link>
        </section>
      </div>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 p-6">
          <div>
            <h2 className="font-semibold">Recent campaigns</h2>
            <p className="mt-1 text-xs text-slate-400">
              Historical source reports and observed unique engagement
            </p>
          </div>
          <Link href="/campaigns" className="text-xs font-medium text-teal-700">
            View all →
          </Link>
        </div>
        {campaigns.length ? (
          <CampaignTable campaigns={campaigns} />
        ) : (
          <p className="px-6 pb-8 text-sm text-slate-500">
            No campaigns have been imported yet.
          </p>
        )}
      </section>
      <div className="mt-6 flex items-start gap-2 text-xs leading-6 text-slate-500">
        <Info className="mt-1 size-4 shrink-0" />
        <p>
          Delivery rate = reported delivered ÷ reported sent. Observed opens
          count distinct customer IDs in correctly attributed raw events; SMS
          opens are not an email-open metric.{" "}
          {number.format(summary.import_problems)} rejected source rows and{" "}
          {number.format(summary.unattributed_events)} unattributed events are
          explained in{" "}
          <Link href="/imports" className="text-teal-700 underline">
            import history
          </Link>
          . {number.format(summary.totals.deleted)} deleted customer records are
          excluded from totals.
        </p>
      </div>
    </>
  );
}
