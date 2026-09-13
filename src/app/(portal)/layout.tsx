import { Activity, LogOut, ShieldCheck } from "lucide-react";
import { requireMembership } from "@/lib/auth";
import { Navigation } from "@/components/navigation";
import { signOut } from "@/app/login/actions";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { brand, membership } = await requireMembership();
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="flex flex-col bg-[#132b30] p-4 text-white lg:sticky lg:top-0 lg:h-screen lg:p-5">
        <div className="flex items-center gap-2 px-2 py-4 text-lg font-semibold">
          <Activity className="size-6 text-teal-300" />
          velocity<span className="font-normal text-teal-200">/</span>
        </div>
        <div className="my-4 rounded-xl border border-white/10 bg-white/[.03] p-3">
          <p className="text-[10px] tracking-widest text-slate-400 uppercase">
            Brand workspace
          </p>
          <p className="mt-2 text-sm font-semibold">{brand.name}</p>
          <p className="mt-1 text-xs text-slate-400">
            {brand.country} ·{" "}
            {membership.role === "owner"
              ? "Owner access"
              : "Analyst · read only"}
          </p>
        </div>
        <Navigation />
        <div className="mt-auto hidden pt-12 lg:block">
          <div className="mb-5 flex items-center gap-2 px-2 text-xs text-slate-400">
            <ShieldCheck className="size-4" />
            Your brand. Your data.
          </div>
          <form action={signOut}>
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-slate-300 hover:bg-white/5">
              <LogOut className="size-4" />
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex min-h-20 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 lg:px-10">
          <div className="text-sm text-slate-500">
            Campaign portal <span className="mx-3 text-slate-300">/</span>
            <span className="font-medium text-slate-700">{brand.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-xs sm:block">
              <p className="font-semibold text-slate-700">
                {membership.display_name}
              </p>
              <p className="mt-1 text-slate-400 capitalize">
                {membership.role}
              </p>
            </div>
            <div className="flex size-9 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-teal-800">
              {membership.display_name
                .split(" ")
                .map((part) => part[0])
                .slice(0, 2)
                .join("")}
            </div>
            <form action={signOut} className="lg:hidden">
              <button aria-label="Sign out" className="p-2">
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </header>
        <main id="main-content" className="mx-auto max-w-[1600px] p-6 lg:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
