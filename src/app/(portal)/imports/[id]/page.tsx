import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireMembership } from "@/lib/auth";
import { PageHeading } from "@/components/page-heading";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { number } from "@/lib/utils";

export default async function ImportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; severity?: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const filters = await searchParams;
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .catch(1)
    .parse(filters.page ?? 1);
  const severity = filters.severity === "error" ? "error" : "all";
  const { supabase } = await requireMembership();
  const { data: run, error: runError } = await supabase
    .from("import_runs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (runError) throw new Error("Import unavailable");
  if (!run) notFound();
  let query = supabase
    .from("import_issues")
    .select("row_number,severity,code,message,external_id,raw", {
      count: "exact",
    })
    .eq("import_run_id", id)
    .order("row_number")
    .order("code")
    .range((page - 1) * 50, page * 50 - 1);
  if (severity === "error") query = query.eq("severity", "error");
  const { data: issues, error, count } = await query;
  if (error || count === null) throw new Error("Import issues unavailable");
  return (
    <>
      <Link href="/imports" className="mb-6 inline-block text-sm text-teal-700">
        ← Import history
      </Link>
      <PageHeading
        title={run.file_name}
        description={`${number.format(run.accepted_rows)} unique valid records · ${number.format(run.rejected_rows)} rejected rows · ${number.format(run.duplicate_rows)} duplicates merged`}
      />
      <div className="mb-6 flex gap-4 text-sm">
        <Link
          href={`/imports/${id}`}
          className={
            severity === "all"
              ? "font-semibold text-teal-700"
              : "text-slate-500"
          }
        >
          All issues
        </Link>
        <Link
          href={`/imports/${id}?severity=error`}
          className={
            severity === "error"
              ? "font-semibold text-teal-700"
              : "text-slate-500"
          }
        >
          Rejected rows
        </Link>
      </div>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="divide-y divide-slate-100">
          {issues.length ? (
            issues.map((issue) => (
              <article
                key={`${issue.row_number}-${issue.code}`}
                className="p-5"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <Badge
                    tone={issue.severity === "error" ? "negative" : "warning"}
                  >
                    {issue.severity === "error" ? "Rejected" : "Warning"}
                  </Badge>
                  <span className="text-xs text-slate-500">
                    Line {number.format(issue.row_number)} ·{" "}
                    {issue.external_id ?? "No ID"}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6">{issue.message}</p>
                <details className="mt-3 text-xs text-slate-500">
                  <summary className="cursor-pointer">
                    View original row
                  </summary>
                  <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-50 p-4 text-[11px] leading-5">
                    {JSON.stringify(issue.raw, null, 2)}
                  </pre>
                </details>
              </article>
            ))
          ) : (
            <div className="p-12 text-center text-sm text-slate-500">
              No {severity === "error" ? "rejected rows" : "issues"} in this
              view.
            </div>
          )}
        </div>
        <Pagination
          page={page}
          total={count}
          pathname={`/imports/${id}`}
          filters={{ severity }}
        />
      </section>
    </>
  );
}
