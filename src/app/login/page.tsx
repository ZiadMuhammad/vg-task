import { Activity, ShieldCheck } from "lucide-react";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative flex flex-col justify-between overflow-hidden bg-[#112e32] p-8 text-white lg:p-16">
        <div className="flex items-center gap-3 text-lg font-semibold">
          <Activity className="size-7 text-teal-300" />
          velocity<span className="font-normal text-teal-200">/ growth</span>
        </div>
        <div className="relative z-10 my-14 max-w-lg">
          <p className="mb-5 text-xs font-semibold tracking-[.2em] text-teal-300 uppercase">
            The campaign workspace
          </p>
          <h1 className="text-4xl leading-tight font-semibold tracking-tight lg:text-5xl">
            Good growth starts with a clearer picture.
          </h1>
          <p className="mt-6 max-w-sm leading-7 text-slate-300">
            Know your customers. Understand your campaigns. Make your next move
            with confidence.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <ShieldCheck className="size-4" />A dedicated workspace for your brand
        </div>
        <div
          aria-hidden
          className="absolute -right-36 bottom-0 size-[500px] rounded-full border-[70px] border-white/[.03]"
        />
      </section>
      <section className="flex items-center justify-center bg-white px-6 py-14 lg:px-16">
        <div className="w-full max-w-sm">
          <p className="mb-2 text-sm text-slate-500">Welcome back</p>
          <h2 className="text-3xl font-semibold tracking-tight">
            Your workspace awaits.
          </h2>
          <p className="mt-3 mb-8 text-sm leading-6 text-slate-500">
            Sign in with the account provided by your administrator.
          </p>
          {error && (
            <p
              role="alert"
              className="mb-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
            >
              {error === "access"
                ? "This account does not have brand access. Sign in with your assigned account."
                : "We couldn’t complete sign-in. Please try again."}
            </p>
          )}
          <LoginForm />
          <p className="mt-7 text-center text-xs leading-5 text-slate-400">
            Access is by invitation. Need help? Contact your workspace
            administrator.
          </p>
        </div>
      </section>
    </main>
  );
}
