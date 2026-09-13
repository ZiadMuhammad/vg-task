import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireMembership } from "@/lib/auth";
import { dispatchSchema, timestamp } from "@/lib/campaigns/dispatch";
import { PageHeading } from "@/components/page-heading";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { ConfirmSend, PrepareSend } from "@/components/campaign-actions";
import { DispatchSummary } from "@/components/dispatch-summary";
import { number } from "@/lib/utils";
export default async function SendPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; approvalId: string }>;
  searchParams: Promise<{ page?: string; batches?: string; issues?: string }>;
}) {
  const { id, approvalId } = await params;
  if (![id, approvalId].every((v) => z.uuid().safeParse(v).success)) notFound();
  const query = await searchParams;
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(100000)
    .catch(1)
    .parse(query.page);
  const batchPage = z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .catch(1)
    .parse(query.batches);
  const issuePage = z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .catch(1)
    .parse(query.issues);
  const { supabase, membership } = await requireMembership();
  const { data, error } = await supabase
    .from("dispatch_metrics")
    .select("*")
    .eq("id", approvalId)
    .eq("campaign_id", id)
    .maybeSingle();
  if (error) throw new Error("Approval unavailable");
  if (!data) notFound();
  const d = dispatchSchema.parse(data);
  const [
    { data: recipients, error: recipientError },
    { data: batches, error: batchError, count: batchCount },
  ] = await Promise.all([
    supabase
      .from("approved_recipients")
      .select(
        "id,position,external_id,full_name,destination,submission_status,submission_reason,delivered,bounced,opened,unsubscribed",
      )
      .eq("approval_id", approvalId)
      .order("position")
      .range((page - 1) * 50, page * 50 - 1),
    supabase
      .from("provider_batches")
      .select(
        "id,batch_number,status,attempts,provider_batch_id,last_error,last_synced_at,next_attempt_at",
        { count: "exact" },
      )
      .eq("approval_id", approvalId)
      .order("batch_number")
      .range((batchPage - 1) * 20, batchPage * 20 - 1),
  ]);
  if (recipientError || batchError)
    throw new Error("Saved dispatch details unavailable");
  const {
    data: issues,
    error: issueError,
    count: issueCount,
  } = await supabase
    .from("provider_event_issues")
    .select(
      "id,reason,first_seen_at,provider_batches!inner(approval_id,batch_number)",
      { count: "exact" },
    )
    .eq("provider_batches.approval_id", approvalId)
    .order("id", { ascending: false })
    .range((issuePage - 1) * 20, issuePage * 20 - 1);
  if (issueError) throw new Error("Provider issue history unavailable");
  const expired = d.expired;
  const pathname = `/campaigns/${id}/send/${approvalId}`;
  return (
    <>
      <Link
        href={`/campaigns/${id}`}
        className="mb-6 inline-block text-sm text-teal-700"
      >
        ← Campaign results
      </Link>
      <PageHeading
        eyebrow={d.approved_at ? "Saved approval" : "Review before sending"}
        title={d.campaign_name}
        description={`${d.channel === "email" ? "Email" : "SMS"} · ${d.target_country ?? "All countries"} · Audience saved ${timestamp(d.prepared_at)}`}
      />
      {d.approved_at ? (
        <DispatchSummary
          dispatch={d}
          owner={membership.role === "owner"}
          showLink={false}
        />
      ) : (
        <section className="mb-7 space-y-5 rounded-xl border border-teal-200 bg-teal-50/40 p-6">
          <div>
            <p className="text-sm text-teal-800">Exact saved audience</p>
            <p className="mt-2 text-4xl font-semibold">
              {number.format(d.recipient_count)}{" "}
              <span className="text-base font-normal text-slate-500">
                destinations
              </span>
            </p>
          </div>
          <p className="max-w-3xl text-sm leading-7 text-slate-600">
            One message per distinct{" "}
            {d.channel === "email" ? "email address" : "phone number"}, using
            currently contactable customers in the target country. Shared
            destinations are excluded if any customer record using them is not
            contactable. The list below is the complete saved audience, across
            all pages. New customers are not added to this approval.
          </p>
          <p className="text-xs leading-6 text-slate-500">
            {expired
              ? "This preview has expired. Refresh it before approving."
              : `Review expires ${timestamp(d.expires_at)}.`}{" "}
            A consent change before confirmation requires a new review.
            Withdrawals after approval are withheld where possible and shown
            separately.
          </p>
          {membership.role === "owner" ? (
            <>
              <ConfirmSend
                campaignId={id}
                approvalId={approvalId}
                count={d.recipient_count}
                hash={d.audience_hash}
                expired={expired}
              />
              <PrepareSend campaignId={id} refresh />
            </>
          ) : (
            <p className="text-sm text-slate-600">
              Only your brand owner can approve this audience.
            </p>
          )}
        </section>
      )}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-semibold">
            {d.approved_at ? "Approved recipients" : "Saved recipients"}
          </h2>
          <p className="mt-2 text-xs text-slate-500">
            Names and destinations are preserved as reviewed. Delivery facts can
            arrive in any order.
          </p>
        </div>
        {recipients.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  {[
                    "Customer",
                    "Saved destination",
                    "Submission",
                    "Observed events",
                  ].map((label) => (
                    <th key={label} className="px-5 py-3 font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-5 py-4">
                      <p className="font-medium">{r.full_name}</p>
                      <p className="mt-1 font-mono text-xs text-slate-400">
                        {r.external_id}
                      </p>
                    </td>
                    <td className="px-5 py-4">{r.destination}</td>
                    <td className="px-5 py-4">
                      <Badge>
                        {d.approved_at
                          ? r.submission_status
                          : "Awaiting approval"}
                      </Badge>
                      {r.submission_reason && (
                        <p className="mt-2 max-w-52 text-xs text-slate-500">
                          {r.submission_reason}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">
                      {[
                        ["Delivered", r.delivered],
                        ["Bounced", r.bounced],
                        ["Opened", r.opened],
                        ["Unsubscribed", r.unsubscribed],
                      ]
                        .filter(([, value]) => value)
                        .map(([label]) => label)
                        .join(" · ") || "No events yet"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-6 text-sm text-slate-500">
            No recipients on this page.
          </p>
        )}
        <Pagination
          page={page}
          total={d.recipient_count}
          pathname={pathname}
          filters={{ batches: String(batchPage), issues: String(issuePage) }}
        />
      </section>
      {d.approved_at && (
        <>
          <section className="mt-7 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="p-5">
              <h2 className="font-semibold">Batch progress</h2>
              <p className="mt-2 text-xs leading-6 text-slate-500">
                A provider batch ID lets the delivery record be reconciled.
                “Accepted” means the submission response was recorded;
                individual recipients may be rejected.
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {batches.map((b) => (
                <div key={b.id} className="space-y-2 px-5 py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm font-medium">
                      Batch {b.batch_number}
                    </p>
                    <Badge>{b.status}</Badge>
                    <span className="text-xs text-slate-500">
                      {b.attempts} attempts
                    </span>
                  </div>
                  <p className="break-all font-mono text-xs text-slate-500">
                    Provider:{" "}
                    {b.provider_batch_id ?? "Awaiting a confirmed response"}
                  </p>
                  <p className="text-xs text-slate-400">
                    Synchronized: {timestamp(b.last_synced_at)}
                  </p>
                  {b.last_error && (
                    <p className="text-sm leading-6 text-amber-800">
                      {b.last_error}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-5 text-sm">
              <p>
                {number.format(batchCount ?? 0)} batches · page {batchPage}
              </p>
              <div className="flex gap-4">
                {batchPage > 1 && (
                  <Link
                    href={`${pathname}?page=${page}&batches=${batchPage - 1}&issues=${issuePage}`}
                    className="text-teal-700"
                  >
                    Previous batches
                  </Link>
                )}
                {batchPage * 20 < (batchCount ?? 0) && (
                  <Link
                    href={`${pathname}?page=${page}&batches=${batchPage + 1}&issues=${issuePage}`}
                    className="text-teal-700"
                  >
                    Next batches
                  </Link>
                )}
              </div>
            </div>
          </section>
          <section className="mt-7 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Provider event issues</h2>
            <p className="mt-2 text-xs leading-6 text-slate-500">
              Invalid or unattributable reports remain visible here and do not
              inflate campaign results. Known valid withdrawals still suppress
              the matching customer.
            </p>
            {issues.length ? (
              <ul className="mt-4 divide-y divide-slate-100">
                {issues.map((issue) => (
                  <li key={issue.id} className="py-4 text-sm">
                    <p>{issue.reason}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      Batch {issue.provider_batches.batch_number} ·{" "}
                      {timestamp(issue.first_seen_at)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                No event issues on this page.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <span>
                {issueCount ?? 0} issues · page {issuePage}
              </span>
              {issuePage > 1 && (
                <Link
                  className="text-teal-700"
                  href={`${pathname}?page=${page}&batches=${batchPage}&issues=${issuePage - 1}`}
                >
                  Previous issues
                </Link>
              )}
              {issuePage * 20 < (issueCount ?? 0) && (
                <Link
                  className="text-teal-700"
                  href={`${pathname}?page=${page}&batches=${batchPage}&issues=${issuePage + 1}`}
                >
                  Next issues
                </Link>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}
