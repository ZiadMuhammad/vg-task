import Link from "next/link";
import { ArrowUpRight, FileText, Info } from "lucide-react";
import { requireMembership } from "@/lib/auth";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { number } from "@/lib/utils";

export default async function ImportsPage() {
  const { supabase } = await requireMembership();
  const { data: runs, error } = await supabase
    .from("import_runs")
    .select("*")
    .order("started_at", { ascending: false });
  if (error) throw new Error("Import history unavailable");
  return (
    <>
      <PageHeading
        eyebrow="Data quality"
        title="Import history"
        description="Every export has a receipt. See what loaded, what was merged, and what needs attention."
      />
      <div className="mb-6 flex gap-3 rounded-xl border border-teal-100 bg-teal-50/60 p-4 text-sm leading-6 text-teal-900">
        <Info className="mt-1 size-4 shrink-0" />
        <p>
          Warnings keep usable records while explaining a limitation. Rejected
          rows are excluded. Re-importing the same export preserves one set of
          records.
        </p>
      </div>
      <div className="space-y-4">
        {runs.length ? (
          runs.map((run) => (
            <Link
              key={run.id}
              href={`/imports/${run.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-teal-300"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 gap-3">
                  <div className="rounded-lg bg-slate-100 p-3">
                    <FileText className="size-5 text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold break-all">
                      {run.file_name}
                    </h2>
                    <p className="mt-2 text-xs text-slate-400">
                      {run.encoding} ·{" "}
                      {new Date(run.started_at).toLocaleString("en-GB", {
                        timeZone: "UTC",
                      })}{" "}
                      UTC
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    tone={
                      run.status === "complete"
                        ? "positive"
                        : run.status === "failed"
                          ? "negative"
                          : "warning"
                    }
                  >
                    {run.status}
                  </Badge>
                  <ArrowUpRight className="size-4 text-slate-400" />
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-5">
                {[
                  ["Source rows", run.total_rows],
                  ["Unique valid", run.accepted_rows],
                  ["Duplicates merged", run.duplicate_rows],
                  ["Rejected", run.rejected_rows],
                  ["Rows with warnings", run.warning_rows],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-lg font-semibold">
                      {number.format(Number(value))}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
              {run.error && (
                <p className="mt-4 text-sm text-red-700">{run.error}</p>
              )}
            </Link>
          ))
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            No exports have been imported yet.
          </div>
        )}
      </div>
      <p className="mt-6 text-xs leading-6 text-slate-500">
        Counts describe each file, so baseline and delta rows can refer to the
        same customer. Warnings overlap valid and duplicate rows. “Unique valid
        + duplicates + rejected” equals source rows for a completed import. The
        September delta replaces baseline attributes; engagement opt-outs remain
        in force.
      </p>
    </>
  );
}
