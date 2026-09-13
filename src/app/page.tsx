import Link from "next/link";
export default function Home() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="max-w-xl space-y-6">
        <p className="text-xs font-bold tracking-[0.24em] text-teal-700">
          VELOCITY GROWTH
        </p>
        <h1 className="text-5xl font-semibold tracking-tight">
          A clearer view of your next campaign.
        </h1>
        <p className="text-lg text-slate-600">
          Your customers, campaigns, and results. One private workspace for your
          team.
        </p>
        <Link
          href="/login"
          className="inline-flex rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
        >
          Open your workspace →
        </Link>
      </section>
    </main>
  );
}
