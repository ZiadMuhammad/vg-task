import { cn } from "@/lib/utils";
export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "positive" | "warning" | "negative";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap",
        {
          neutral: "bg-slate-100 text-slate-600",
          positive: "bg-teal-50 text-teal-800",
          warning: "bg-amber-50 text-amber-800",
          negative: "bg-red-50 text-red-700",
        }[tone],
      )}
    >
      {children}
    </span>
  );
}
