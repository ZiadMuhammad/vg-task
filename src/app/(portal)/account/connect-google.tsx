"use client";

import { useActionState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { connectGoogle } from "./actions";

export function ConnectGoogle() {
  const [state, action, pending] = useActionState(connectGoogle, {});
  return (
    <form action={action} className="space-y-3">
      <Button disabled={pending}>
        {pending && (
          <LoaderCircle aria-hidden className="size-4 animate-spin" />
        )}
        {pending ? "Opening Google…" : "Connect Google"}
      </Button>
      {state.error && (
        <p role="alert" className="text-sm leading-6 text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
