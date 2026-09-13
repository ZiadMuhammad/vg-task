"use client";
import { useActionState } from "react";
import { LockKeyhole, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { unlockReport } from "./actions";
export function UnlockForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(unlockReport, {});
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={id} />
      <div className="space-y-2">
        <label htmlFor="report-password" className="text-sm font-medium">
          Report password
        </label>
        <Input
          id="report-password"
          name="password"
          type="password"
          autoComplete="current-password"
          minLength={12}
          maxLength={64}
          required
        />
      </div>
      {state.error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-800"
        >
          {state.error}
        </p>
      )}
      <Button disabled={pending} className="w-full">
        {pending ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <LockKeyhole className="size-4" />
        )}
        {pending ? "Checking access…" : "Unlock report"}
      </Button>
    </form>
  );
}
