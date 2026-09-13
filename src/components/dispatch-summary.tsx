import Link from "next/link";
import {
  CheckCheck,
  Clock3,
  Send,
  ShieldAlert,
  UserMinus,
  Mail,
} from "lucide-react";
import { MetricCard } from "./metric-card";
import { Badge } from "./ui/badge";
import { RetrySend } from "./campaign-actions";
import { RefreshStatus } from "./refresh-status";
import { type Dispatch, timestamp } from "@/lib/campaigns/dispatch";
import { number } from "@/lib/utils";
export function DispatchSummary({
  dispatch: d,
  owner = false,
  showLink = true,
}: {
  dispatch: Dispatch;
  owner?: boolean;
  showLink?: boolean;
}) {
  return (
    <section className="mb-7 space-y-5 rounded-xl border border-teal-200 bg-teal-50/40 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-semibold">Live dispatch</h2>
            <Badge>
              {d.attention_batches
                ? "Needs attention"
                : d.pending_batches
                  ? "In progress"
                  : "Submission recorded"}
            </Badge>
          </div>
          <p className="mt-2 text-xs leading-6 text-slate-500">
            Approved {timestamp(d.approved_at)} ·{" "}
            {number.format(d.recipient_count)} saved destinations
          </p>
        </div>
        <RefreshStatus automatic={d.pending_batches > 0} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Send}
          label="Provider accepted"
          value={d.accepted}
          detail="Acceptance does not prove delivery"
        />
        <MetricCard
          icon={Clock3}
          label="Awaiting outcome"
          value={d.queued}
          detail={`${number.format(d.pending_batches)} active · ${number.format(d.attention_batches)} paused batches`}
        />
        <MetricCard
          icon={ShieldAlert}
          label="Provider rejected"
          value={d.rejected}
          detail="Explicit rejection in send response"
        />
        <MetricCard
          icon={UserMinus}
          label="Withheld"
          value={d.withheld}
          detail="Contactability changed before dispatch"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={CheckCheck}
          label="Observed delivered"
          value={d.delivered}
          detail="Unique saved recipients with a delivery event"
        />
        <MetricCard
          icon={ShieldAlert}
          label="Observed bounced"
          value={d.bounced}
          detail="May overlap delivered when reports conflict"
        />
        <MetricCard
          icon={Mail}
          label="Observed opens"
          value={d.channel === "email" ? d.opened : "Not applicable"}
          detail="Unique saved recipients; repeat opens count once"
        />
        <MetricCard
          icon={UserMinus}
          label="Unsubscribed"
          value={d.unsubscribed}
          detail="Removed from future contactable audiences"
        />
      </div>
      <p className="text-xs leading-6 text-slate-500">
        Background delivery checks continue when this page is closed. Last batch
        synchronization: {timestamp(d.last_synced_at)}. Completed event streams
        are checked again every five minutes for late reports.{" "}
        {number.format(d.issue_count)} event issues recorded. Imported
        historical totals below remain separate.
      </p>
      {d.attention_batches > 0 && (
        <div
          role="status"
          className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4"
        >
          <p className="text-sm leading-6">
            Some batches need attention. Their recipients remain in the approved
            total; an unknown outcome is never counted as delivered. Recovery
            reuses the original request. A consent change after an uncertain
            request keeps that batch paused.
          </p>
          {owner && <RetrySend approvalId={d.id} />}
        </div>
      )}
      {showLink && (
        <Link
          className="inline-block text-sm font-semibold text-teal-700 underline underline-offset-4"
          href={`/campaigns/${d.campaign_id}/send/${d.id}`}
        >
          View saved audience, batch progress & event issues →
        </Link>
      )}
    </section>
  );
}
