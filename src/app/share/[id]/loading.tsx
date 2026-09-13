export default function ReportLoading() {
  return (
    <main
      className="mx-auto max-w-5xl animate-pulse px-5 py-16"
      aria-label="Loading report"
    >
      <div className="h-8 w-56 rounded bg-slate-200" />
      <div className="mt-8 grid gap-5 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-44 rounded-xl bg-slate-200" />
        ))}
      </div>
      <p className="sr-only">Loading report…</p>
    </main>
  );
}
