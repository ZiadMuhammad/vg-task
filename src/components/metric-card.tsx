import type { LucideIcon } from "lucide-react";
import { number } from "@/lib/utils";
export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  detail: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{label}</p>
        <div className="rounded-lg bg-teal-50 p-2">
          <Icon className="size-4 text-teal-700" />
        </div>
      </div>
      <p className="mt-5 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
        {typeof value === "number" ? number.format(value) : value}
      </p>
      <p className="mt-3 text-xs leading-5 text-slate-400">{detail}</p>
    </div>
  );
}
