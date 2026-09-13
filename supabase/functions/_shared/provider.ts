/** Strict at the envelope, tolerant of documented recipient aliases. No credentials in errors. */
export type Recipient = {
  id: string;
  external_id: string;
  channel: string;
  email: string | null;
  phone: string | null;
};
export type Payload = {
  campaign: string;
  brand: string;
  recipients: Recipient[];
};
export type RecipientResult = {
  id: string;
  status: "accepted" | "rejected";
  reason?: string;
};
export type NormalizedEvent = {
  event_id: string | null;
  recipient_id: string;
  type: string;
  channel: string | null;
  occurred_at: string | null;
};
export class ProviderError extends Error {
  constructor(
    message: string,
    public delay = 60,
    public attention = false,
  ) {
    super(message);
  }
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ProviderError("Provider returned an invalid object", 60, true);
  return value as Record<string, unknown>;
}
function string(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= 500
    ? value
    : null;
}
function identity(value: unknown): string | null {
  if (typeof value === "string") return value;
  const v = object(value);
  return (
    string(v.id) ??
    string(v.recipient_id) ??
    string(v.external_id) ??
    string(v.contact_id) ??
    string(v.email)
  );
}
export function parseDispatch(value: unknown, payload: Payload) {
  const body = object(value);
  const batchId = string(body.batch_id);
  if (
    !batchId ||
    !Array.isArray(body.accepted) ||
    !Array.isArray(body.rejected)
  )
    throw new ProviderError(
      "Provider response is missing the batch or recipient outcomes",
      60,
      true,
    );
  const aliases = new Map<string, string>();
  for (const r of payload.recipients)
    for (const key of [r.id, r.external_id, r.email, r.phone])
      if (key) aliases.set(key, r.id);
  const results: RecipientResult[] = [];
  for (const status of ["accepted", "rejected"] as const) {
    for (const item of body[status] as unknown[]) {
      const key = identity(item);
      const id = key ? aliases.get(key) : null;
      if (!id)
        throw new ProviderError(
          "Provider response contains an unknown recipient",
          60,
          true,
        );
      // Provider text is untrusted and may contain PII; use a bounded generic reason in the portal.
      results.push({
        id,
        status,
        ...(status === "rejected"
          ? { reason: "Provider rejected this recipient" }
          : {}),
      });
    }
  }
  if (
    results.length !== payload.recipients.length ||
    new Set(results.map((r) => r.id)).size !== payload.recipients.length
  )
    throw new ProviderError(
      "Provider response does not account for every recipient exactly once",
      60,
      true,
    );
  return { batchId, results };
}
export function parseEvents(value: unknown, previousCursor: string | null) {
  const body = object(value);
  if (
    !Array.isArray(body.events) ||
    typeof body.has_more !== "boolean" ||
    !(body.next_cursor === null || typeof body.next_cursor === "string")
  )
    throw new ProviderError("Provider event pagination is invalid");
  if (
    body.has_more &&
    (!body.next_cursor || body.next_cursor === previousCursor)
  )
    throw new ProviderError("Provider event cursor did not advance");
  const events: NormalizedEvent[] = [];
  const issues: { reason: string; fingerprint: string }[] = [];
  for (const raw of body.events) {
    try {
      const e = object(raw);
      const recipientId =
        string(e.recipient_id) ??
        string(e.contact_id) ??
        string(e.external_id) ??
        (e.recipient ? identity(e.recipient) : null);
      const type = string(e.type) ?? string(e.event_type) ?? string(e.event);
      if (
        !recipientId ||
        !type ||
        !["delivered", "bounced", "opened", "unsubscribed"].includes(type)
      )
        throw new Error("Invalid event");
      const time =
        string(e.occurred_at) ??
        string(e.timestamp) ??
        string(e.created_at) ??
        string(e.at);
      events.push({
        event_id: string(e.event_id) ?? string(e.id),
        recipient_id: recipientId,
        type,
        channel: string(e.channel),
        occurred_at:
          time && Number.isFinite(Date.parse(time))
            ? new Date(time).toISOString()
            : null,
      });
    } catch {
      issues.push({
        reason: "Provider event has an unsupported type or missing recipient",
        fingerprint: JSON.stringify(raw),
      });
    }
  }
  return {
    events,
    issues,
    cursor: body.next_cursor as string | null,
    more: body.has_more,
  };
}
export function retryDelay(header: string | null, now = Date.now()) {
  if (!header) return 60;
  const seconds = Number(header);
  const delay = Number.isFinite(seconds)
    ? seconds
    : (Date.parse(header) - now) / 1000;
  return Number.isFinite(delay)
    ? Math.min(86400, Math.max(10, Math.ceil(delay)))
    : 60;
}
export class ProviderClient {
  constructor(
    private key: string,
    private fetcher: typeof fetch = fetch,
  ) {}
  private async request(path: string, init: RequestInit = {}) {
    let response: Response;
    try {
      response = await this.fetcher(
        `https://dispatcher-production-72fc.up.railway.app${path}`,
        {
          ...init,
          headers: {
            Authorization: `Bearer ${this.key}`,
            "Content-Type": "application/json",
            ...init.headers,
          },
          signal: AbortSignal.timeout(15000),
          redirect: "error",
        },
      );
    } catch {
      throw new ProviderError(
        "Provider connection interrupted; outcome may be unknown",
      );
    }
    if (!response.ok) {
      const delay = retryDelay(response.headers.get("retry-after"));
      throw new ProviderError(
        `Provider HTTP ${response.status}; request preserved for recovery`,
        delay,
        response.status >= 400 &&
          response.status < 500 &&
          ![408, 429].includes(response.status),
      );
    }
    try {
      return await response.json();
    } catch {
      throw new ProviderError(
        "Provider returned unreadable JSON; outcome may be unknown",
      );
    }
  }
  async send(payload: Payload, key: string) {
    return parseDispatch(
      await this.request("/v1/messages", {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(payload),
      }),
      payload,
    );
  }
  async events(batchId: string, cursor: string | null) {
    return parseEvents(
      await this.request(
        `/v1/messages/${encodeURIComponent(batchId)}/events${cursor ? `?since=${encodeURIComponent(cursor)}` : ""}`,
      ),
      cursor,
    );
  }
}
