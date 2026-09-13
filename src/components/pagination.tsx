import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
import { number } from "@/lib/utils";

export function Pagination({
  page,
  total,
  pageSize = 50,
  pathname,
  filters = {},
}: {
  page: number;
  total: number;
  pageSize?: number;
  pathname: string;
  filters?: Record<string, string>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (target: number) =>
    `${pathname}?${new URLSearchParams({ ...filters, page: String(target) })}`;
  if (page > pages)
    return (
      <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
        <p className="text-xs text-slate-500">
          No results on this page · {number.format(total)} total
        </p>
        <Button asChild variant="secondary">
          <Link href={href(1)}>First page</Link>
        </Button>
      </div>
    );
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
      <p className="text-xs text-slate-500">
        {total
          ? `${number.format((page - 1) * pageSize + 1)}–${number.format(Math.min(page * pageSize, total))} of ${number.format(total)}`
          : "0 results"}
      </p>
      <div className="flex items-center gap-3">
        {page > 1 ? (
          <Button asChild variant="secondary">
            <Link href={href(page - 1)} aria-label="Previous page">
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
        ) : (
          <Button variant="secondary" disabled aria-label="Previous page">
            <ChevronLeft className="size-4" />
          </Button>
        )}
        <span className="text-xs text-slate-500">
          Page {number.format(page)} of {number.format(pages)}
        </span>
        {page < pages ? (
          <Button asChild variant="secondary">
            <Link href={href(page + 1)} aria-label="Next page">
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        ) : (
          <Button variant="secondary" disabled aria-label="Next page">
            <ChevronRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
