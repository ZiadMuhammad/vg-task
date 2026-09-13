"use client";
import { useActionState } from "react";
import { LoaderCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  prepareCampaign,
  confirmCampaign,
  retryCampaign,
} from "@/app/(portal)/campaigns/actions";
import { number } from "@/lib/utils";
export function PrepareSend({
  campaignId,
  refresh = false,
}: {
  campaignId: string;
  refresh?: boolean;
}) {
  const [state, action, pending] = useActionState(prepareCampaign, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="campaign_id" value={campaignId} />
      <input type="hidden" name="refresh" value={String(refresh)} />
      <Button disabled={pending} variant={refresh ? "secondary" : "primary"}>
        {pending ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <Send className="size-4" />
        )}
        {pending
          ? "Saving audience…"
          : refresh
            ? "Refresh audience"
            : "Review audience & send"}
      </Button>
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
export function ConfirmSend({
  campaignId,
  approvalId,
  count,
  hash,
  expired,
}: {
  campaignId: string;
  approvalId: string;
  count: number;
  hash: string;
  expired: boolean;
}) {
  const [state, action, pending] = useActionState(confirmCampaign, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="campaign_id" value={campaignId} />
      <input type="hidden" name="approval_id" value={approvalId} />
      <input type="hidden" name="count" value={count} />
      <input type="hidden" name="hash" value={hash} />
      <label className="flex items-start gap-3 text-sm leading-6">
        <input
          type="checkbox"
          name="acknowledged"
          value="yes"
          required
          disabled={expired || count === 0}
          className="mt-1 size-4 accent-teal-700"
        />
        I approve sending to these {number.format(count)} saved destinations.
      </label>
      <Button disabled={pending || expired || count === 0}>
        {pending && <LoaderCircle className="size-4 animate-spin" />}
        {pending
          ? "Recording approval…"
          : `Approve ${number.format(count)} recipients & send`}
      </Button>
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
export function RetrySend({ approvalId }: { approvalId: string }) {
  const [state, action, pending] = useActionState(retryCampaign, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="approval_id" value={approvalId} />
      <Button disabled={pending} variant="secondary">
        {pending ? "Queuing recovery…" : "Retry paused batches"}
      </Button>
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
