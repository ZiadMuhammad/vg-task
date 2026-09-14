"use client";
import { Button } from "@/components/ui/button";
import { useTransition } from "react";
export default function ReportError({ retry }: { retry: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <main className="grid min-h-screen place-items-center px-5">
      <div className="max-w-md space-y-5 text-center">
        <h1 className="text-2xl font-semibold">
          The report is temporarily unavailable.
        </h1>
        <p className="text-sm leading-7 text-slate-500">
          We couldn’t load the latest results. Please try again shortly.
        </p>
        <Button
          disabled={pending}
          onClick={() => startTransition(() => retry())}
        >
          {pending ? "Reloading…" : "Try again"}
        </Button>
      </div>
    </main>
  );
}
