"use client";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function PageLoadError({ retry }: { retry: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-white p-8">
      <h1 className="text-xl font-semibold">We couldn’t load this page.</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">
        The latest data is temporarily unavailable. Reload to check the current
        status.
      </p>
      <p className="mt-3 mb-5 text-sm leading-6 text-slate-500">
        Any send you already approved continues in the background. Reloading
        this page will not send another campaign.
      </p>
      <Button disabled={pending} onClick={() => startTransition(() => retry())}>
        {pending ? "Reloading…" : "Try again"}
      </Button>
    </div>
  );
}
