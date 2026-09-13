import { describe, expect, it, vi } from "vitest";
import {
  parseDispatch,
  parseEvents,
  ProviderClient,
  ProviderError,
  retryDelay,
  type Payload,
} from "../../supabase/functions/_shared/provider";
const payload: Payload = {
  campaign: "Test",
  brand: "MARRAKECH",
  recipients: [
    {
      id: "recipient-1",
      external_id: "source-1",
      channel: "email",
      email: "one@example.test",
      phone: null,
    },
  ],
};
describe("provider boundary", () => {
  it("requires every request recipient to have exactly one explicit outcome", () => {
    expect(
      parseDispatch(
        { batch_id: "batch", accepted: ["source-1"], rejected: [] },
        payload,
      ).results,
    ).toEqual([{ id: "recipient-1", status: "accepted" }]);
    for (const accepted of [[], ["unknown"], ["recipient-1", "recipient-1"]])
      expect(() =>
        parseDispatch({ batch_id: "batch", accepted, rejected: [] }, payload),
      ).toThrow(ProviderError);
    expect(() =>
      parseDispatch(
        {
          batch_id: "batch",
          accepted: ["recipient-1"],
          rejected: ["recipient-1"],
        },
        payload,
      ),
    ).toThrow();
  });
  it("retains adverse events with invalid timestamps and quarantines malformed events", () => {
    const result = parseEvents(
      {
        events: [
          {
            event_id: "e1",
            recipient_id: "recipient-1",
            type: "unsubscribed",
            timestamp: "bad",
          },
          { type: "unknown" },
        ],
        next_cursor: null,
        has_more: false,
      },
      null,
    );
    expect(result.events).toEqual([
      {
        event_id: "e1",
        recipient_id: "recipient-1",
        type: "unsubscribed",
        channel: null,
        occurred_at: null,
      },
    ]);
    expect(result.issues).toHaveLength(1);
  });
  it("does not advance a broken pagination response", () => {
    expect(() =>
      parseEvents({ events: [], next_cursor: "same", has_more: true }, "same"),
    ).toThrow("did not advance");
    expect(() => parseEvents({ events: [] }, null)).toThrow("pagination");
  });
  it("authenticates sends and polls; retries use identical payloads and keys", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(
        Response.json({
          batch_id: "batch",
          accepted: ["recipient-1"],
          rejected: [],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ events: [], next_cursor: null, has_more: false }),
      );
    const client = new ProviderClient("test-key", fetcher);
    await expect(client.send(payload, "stable-key")).rejects.toThrow(
      "interrupted",
    );
    await client.send(payload, "stable-key");
    await client.events("batch", null);
    expect(fetcher.mock.calls[0][1]?.body).toBe(fetcher.mock.calls[1][1]?.body);
    for (const [, init] of fetcher.mock.calls)
      expect(new Headers(init?.headers).get("Authorization")).toBe(
        "Bearer test-key",
      );
    for (const [, init] of fetcher.mock.calls.slice(0, 2))
      expect(new Headers(init?.headers).get("Idempotency-Key")).toBe(
        "stable-key",
      );
  });
  it("honors Retry-After without treating throttling as success", async () => {
    const client = new ProviderClient(
      "test-key",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response("", { status: 429, headers: { "Retry-After": "120" } }),
        ),
    );
    await expect(client.send(payload, "stable")).rejects.toMatchObject({
      delay: 120,
      attention: false,
    });
    expect(
      retryDelay(
        "Wed, 01 Jan 2025 00:02:00 GMT",
        Date.parse("2025-01-01T00:00:00Z"),
      ),
    ).toBe(120);
  });
});
