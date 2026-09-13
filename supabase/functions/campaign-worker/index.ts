import { createClient } from "@supabase/supabase-js";
import {
  ProviderClient,
  ProviderError,
  type Payload,
} from "../_shared/provider.ts";

const required = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};
const db = createClient(
  required("SUPABASE_URL"),
  required("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const provider = new ProviderClient(required("VG_PROVIDER_API_KEY"));
const workerSecret = required("WORKER_SECRET");
async function authorized(header: string | null) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(workerSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(workerSecret),
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    encoder.encode(header ?? ""),
  );
}
async function rpc<T>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await db.rpc(name, args);
  if (error)
    throw new Error(`Database operation failed: ${name} (${error.code})`);
  return data as T;
}
type Work = {
  batch_id: string;
  token: string;
  payload: Payload;
  idempotency_key: string;
  attempt: number;
};
type Poll = {
  batch_id: string;
  token: string;
  provider_id: string;
  cursor: string | null;
};
Deno.serve(async (request) => {
  if (
    request.method !== "POST" ||
    !(await authorized(request.headers.get("x-worker-secret")))
  )
    return new Response("Unauthorized", { status: 401 });
  const deadline = Date.now() + 45000;
  let sends = 0,
    polls = 0;
  try {
    for (let i = 0; i < 10 && Date.now() < deadline; i++) {
      const work = await rpc<Work | null>("claim_dispatch");
      if (!work) break;
      try {
        const result = await provider.send(work.payload, work.idempotency_key);
        await rpc("finish_dispatch", {
          p_batch_id: work.batch_id,
          p_token: work.token,
          p_provider_id: result.batchId,
          p_results: result.results,
        });
        sends++;
      } catch (error) {
        const known = error instanceof ProviderError;
        await rpc("fail_dispatch", {
          p_batch_id: work.batch_id,
          p_token: work.token,
          p_reason: known
            ? error.message
            : "Could not record the provider result; retry preserves the request",
          p_delay: known
            ? Math.max(
                error.delay,
                Math.min(3600, 10 * 2 ** Math.min(work.attempt, 8)),
              )
            : 60,
          p_attention: known && error.attention,
        });
        break;
      }
    }
    for (let i = 0; i < 20 && Date.now() < deadline; i++) {
      const poll = await rpc<Poll | null>("claim_event_poll");
      if (!poll) break;
      try {
        const page = await provider.events(poll.provider_id, poll.cursor);
        await rpc("finish_event_poll", {
          p_batch_id: poll.batch_id,
          p_token: poll.token,
          p_events: page.events,
          p_issues: page.issues,
          p_cursor: page.cursor,
          p_more: page.more,
        });
        polls++;
      } catch (error) {
        await rpc("fail_event_poll", {
          p_batch_id: poll.batch_id,
          p_token: poll.token,
          p_reason:
            error instanceof ProviderError
              ? error.message
              : "Delivery page could not be saved; cursor preserved for retry",
          p_delay: error instanceof ProviderError ? error.delay : 60,
        });
        break;
      }
    }
    return Response.json({ sends, polls });
  } catch {
    console.error(
      "Campaign worker could not complete its database operation; leases will expire.",
    );
    return Response.json(
      { error: "Worker interrupted; durable work remains queued" },
      { status: 503 },
    );
  }
});
