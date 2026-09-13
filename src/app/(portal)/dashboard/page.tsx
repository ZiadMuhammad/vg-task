import { requireMembership } from "@/lib/auth";

export default async function DashboardPage() {
  const { brand } = await requireMembership();
  return (
    <>
      <p className="text-sm text-slate-500">Your brand at a glance</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        {brand.name} overview
      </h1>
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-8">
        <h2 className="font-semibold">Your workspace is ready</h2>
        <p className="mt-2 text-sm text-slate-500">
          Customer and campaign metrics will appear once your exports are
          imported.
        </p>
      </div>
    </>
  );
}
