import { z } from "zod";
import { notFound } from "next/navigation";
import {
  LockKeyhole,
  CheckCheck,
  Send,
  ShieldAlert,
  Mail,
  UserMinus,
  MousePointer2,
} from "lucide-react";
import { loadSharedReport } from "@/lib/reports/data";
import { timestamp } from "@/lib/campaigns/dispatch";
import { MetricCard } from "@/components/metric-card";
import { Badge } from "@/components/ui/badge";
import { UnlockForm } from "./unlock-form";
import { RefreshStatus } from "@/components/refresh-status";
import { number } from "@/lib/utils";
export const metadata = {
  title: "Protected campaign report",
  description: "A password-protected campaign results report.",
  robots: { index: false, follow: false },
};
export default async function SharedReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const report = await loadSharedReport(id);
  if (!report)
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-5 py-12">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
          <div className="mb-7 grid size-12 place-items-center rounded-xl bg-teal-50 text-teal-700">
            <LockKeyhole className="size-6" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">
            Velocity · Client report
          </p>
          <h1 className="mt-3 text-2xl font-semibold">
            A closer look at the results.
          </h1>
          <p className="mb-7 mt-3 text-sm leading-7 text-slate-500">
            Enter the password shared with you to view this campaign’s results.
          </p>
          <UnlockForm id={id} />
          <p className="mt-6 text-xs leading-6 text-slate-400">
            Access lasts one hour. Contact the person who shared this link if
            you need the password.
          </p>
        </section>
      </main>
    );
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10 sm:px-8 sm:py-16">
      <header className="mb-9 flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">
            {report.brand_name} · Campaign report
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            {report.campaign_name}
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            Campaign results, shared securely.
          </p>
        </div>
        <Badge>{report.channel === "email" ? "Email" : "SMS"}</Badge>
      </header>
      {report.live && (
        <section className="mb-8 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Live dispatch results</h2>
              <p className="mt-2 text-xs text-slate-500">
                Approved {timestamp(report.live.approved_at)} ·{" "}
                {number.format(report.live.approved)} saved destinations
              </p>
            </div>
            <RefreshStatus />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              icon={Send}
              label="Provider accepted"
              value={report.live.accepted}
              detail="Accepted for processing; delivery is separate"
            />
            <MetricCard
              icon={CheckCheck}
              label="Observed delivered"
              value={report.live.delivered}
              detail="Unique recipients with delivery reports"
            />
            <MetricCard
              icon={ShieldAlert}
              label="Observed bounced"
              value={report.live.bounced}
              detail="Unique recipients with bounce reports"
            />
            <MetricCard
              icon={Mail}
              label="Unique opens"
              value={
                report.channel === "email"
                  ? report.live.opens
                  : "Not applicable"
              }
              detail="Repeated opens count once per recipient"
            />
            <MetricCard
              icon={UserMinus}
              label="Unsubscribed"
              value={report.live.unsubscribed}
              detail="Removed from future contactable audiences"
            />
            <MetricCard
              icon={Send}
              label="Awaiting outcome"
              value={report.live.queued}
              detail={`${number.format(report.live.rejected)} rejected · ${number.format(report.live.withheld)} withheld`}
            />
          </div>
          <p className="text-xs leading-6 text-slate-500">
            These are provider observations for the saved audience. Event types
            may overlap, and an open is not treated as proof of delivery. Last
            batch synchronization: {timestamp(report.live.last_synced_at)}.
            Delayed reports may change these results.
          </p>
        </section>
      )}
      <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-7">
        <div>
          <h2 className="text-lg font-semibold">Historical campaign report</h2>
          <p className="mt-2 text-xs text-slate-500">
            Source export · {timestamp(report.historical_date)}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            icon={Send}
            label="Reported sent"
            value={report.reported.sent}
            detail="Source campaign total"
          />
          <MetricCard
            icon={CheckCheck}
            label="Reported delivered"
            value={report.reported.delivered}
            detail="Source campaign total"
          />
          <MetricCard
            icon={ShieldAlert}
            label="Reported bounced"
            value={report.reported.bounced}
            detail="Source campaign total"
          />
          <MetricCard
            icon={Mail}
            label="Reported opens"
            value={
              report.channel === "email"
                ? report.reported.opens
                : "Not applicable"
            }
            detail="Source event count; may include repeat opens"
          />
          <MetricCard
            icon={Mail}
            label="Observed unique opens"
            value={
              report.channel === "email"
                ? report.observed.opens
                : "Not applicable"
            }
            detail="Distinct customer IDs in the supplied event log"
          />
          <MetricCard
            icon={MousePointer2}
            label="Observed unique clicks"
            value={report.observed.clicks}
            detail="Distinct customer IDs in the supplied event log"
          />
        </div>
        <p className="text-xs leading-6 text-slate-500">
          Historical totals are preserved from the campaign export. Observed
          engagement uses correctly attributed raw events and may cover less
          than the full historical audience. Reported opens may exceed
          deliveries. These historical figures are separate from any live
          dispatch above.
        </p>
      </section>
      <footer className="mt-8 border-t border-slate-200 pt-5 text-xs text-slate-400">
        Velocity · Campaign results
      </footer>
    </main>
  );
}
