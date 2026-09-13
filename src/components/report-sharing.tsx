"use client";
import { useActionState, useState } from "react";
import { ExternalLink, Link2, LoaderCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  publishReport,
  revokeReport,
} from "@/app/(portal)/campaigns/report-actions";
export function ReportSharing({
  campaignId,
  report,
}: {
  campaignId: string;
  report: { id: string; active: boolean } | null;
}) {
  const [copyStatus, setCopyStatus] = useState("");
  const [published, publish, publishing] = useActionState(publishReport, {});
  const [revoked, revoke, revoking] = useActionState(revokeReport, {});
  return (
    <section className="mt-7 space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <Link2 className="size-5 text-teal-700" />
        <h2 className="font-semibold">Share campaign results</h2>
      </div>
      <p className="max-w-3xl text-sm leading-7 text-slate-500">
        Create a password-protected report for someone without a portal account.
        It contains this campaign’s aggregate results, with no customer names,
        addresses or recipient lists.
      </p>
      {report?.active && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-teal-200 bg-teal-50 p-4">
          <a
            href={`/share/${report.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm font-semibold text-teal-800"
          >
            Open shared report <ExternalLink className="size-4" />
          </a>
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  new URL(
                    `/share/${report.id}`,
                    window.location.origin,
                  ).toString(),
                );
                setCopyStatus("Link copied");
              } catch {
                setCopyStatus("Open the report and copy its address.");
              }
            }}
          >
            {copyStatus || "Copy link"}
          </Button>
          <form action={revoke}>
            <input type="hidden" name="campaign_id" value={campaignId} />
            <input type="hidden" name="report_id" value={report.id} />
            <Button variant="secondary" disabled={revoking}>
              {revoking ? "Revoking access…" : "Revoke link"}
            </Button>
          </form>
          <p className="w-full break-all text-xs text-teal-800">
            Link path: /share/{report.id}
          </p>
        </div>
      )}
      {report && !report.active && (
        <p className="text-sm text-slate-500">
          This link is revoked. Publish with a new password to restore access.
        </p>
      )}
      <form action={publish} className="max-w-xl space-y-4">
        <input type="hidden" name="campaign_id" value={campaignId} />
        <div className="space-y-2">
          <label htmlFor="share-password" className="text-sm font-medium">
            {report?.active
              ? "Replace report password"
              : "Choose a report password"}
          </label>
          <Input
            id="share-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={64}
            required
            aria-describedby="password-guidance"
          />
          <p
            id="password-guidance"
            className="text-xs leading-6 text-slate-400"
          >
            At least 12 characters. Save the password before publishing; it
            cannot be retrieved. Replacing it signs out anyone viewing this
            report.
          </p>
        </div>
        <Button disabled={publishing}>
          {publishing && <LoaderCircle className="size-4 animate-spin" />}
          {publishing
            ? "Publishing…"
            : report?.active
              ? "Replace password"
              : "Publish password-protected report"}
        </Button>
        {published.error && (
          <p role="alert" className="text-sm text-red-700">
            {published.error}
          </p>
        )}
        {published.reportId && report?.active && !published.error && (
          <p role="status" className="text-sm text-teal-800">
            Report published. Send the link and password to your recipient.
          </p>
        )}
      </form>
      {revoked.error && (
        <p role="alert" className="text-sm text-red-700">
          {revoked.error}
        </p>
      )}
    </section>
  );
}
