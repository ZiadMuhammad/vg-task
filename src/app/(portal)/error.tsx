"use client";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-white p-8">
      <h1 className="text-xl font-semibold">We couldn’t load this page.</h1>
      <p className="mt-3 mb-5 text-sm text-slate-500">
        The latest data is unavailable. Try again to check the current status.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
