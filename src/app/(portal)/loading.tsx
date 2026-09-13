export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading workspace"
      className="animate-pulse space-y-6"
    >
      <div className="h-8 w-60 rounded bg-slate-200" />
      <div className="grid gap-5 sm:grid-cols-3">
        {[0, 1, 2].map((id) => (
          <div key={id} className="h-36 rounded-xl bg-slate-200" />
        ))}
      </div>
      <div className="h-80 rounded-xl bg-slate-200" />
      <span className="sr-only">Loading your workspace…</span>
    </div>
  );
}
