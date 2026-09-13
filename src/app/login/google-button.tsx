"use client";
import { useActionState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { googleLogin } from "./actions";
export function GoogleButton() {
  const [state, action, pending] = useActionState(googleLogin, {});
  return (
    <div className="mt-6">
      <div className="relative mb-6 text-center">
        <div className="absolute inset-x-0 top-1/2 border-t border-slate-200" />
        <span className="relative bg-white px-3 text-xs text-slate-400">
          or
        </span>
      </div>
      <form action={action} className="space-y-3">
        <Button className="w-full" variant="secondary" disabled={pending}>
          {pending ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <span aria-hidden className="text-base font-bold">
              G
            </span>
          )}
          {pending ? "Opening Google…" : "Continue with Google"}
        </Button>
        {state.error && (
          <p role="alert" className="text-sm leading-6 text-red-700">
            {state.error}
          </p>
        )}
      </form>
    </div>
  );
}
