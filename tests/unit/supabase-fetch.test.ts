import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { fetchWithGatewayRetry } from "../../src/lib/supabase/fetch";

const url =
  "https://example.supabase.co/rest/v1/memberships?user_id=eq.private";
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("Supabase gateway recovery", () => {
  it.each([502, 504])(
    "recovers an authenticated read after HTTP %s",
    async (status) => {
      fetchMock
        .mockResolvedValueOnce(
          new Response("Gateway timeout", { status }).clone(),
        )
        .mockResolvedValueOnce(Response.json([{ user_id: "private" }]));
      const client = createClient("https://example.supabase.co", "test-key", {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: fetchWithGatewayRetry },
      });
      const result = Promise.resolve(
        client.from("memberships").select("user_id").eq("user_id", "private"),
      );
      await vi.runAllTimersAsync();
      expect(await result).toMatchObject({
        data: [{ user_id: "private" }],
        error: null,
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0]).toEqual(fetchMock.mock.calls[1]);
      const headers = new Headers(fetchMock.mock.calls[1][1]?.headers);
      expect(headers.get("authorization")).toBe("Bearer test-key");
      expect(fetchMock.mock.calls[1][1]?.signal).toBeInstanceOf(AbortSignal);
      expect(fetchMock.mock.calls[1][1]?.cache).toBe("no-store");
      expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(
        "private",
      );
      expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(
        "test-key",
      );
    },
  );

  it("returns the actual failure after bounded retries, never an empty success", async () => {
    fetchMock.mockImplementation(
      async () => new Response("Gateway timeout", { status: 504 }),
    );
    const result = fetchWithGatewayRetry(url);
    await vi.runAllTimersAsync();
    const response = await result;
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(response.status).toBe(504);
    expect(await response.text()).toBe("Gateway timeout");
  });

  it("never replays a campaign confirmation after an uncertain response", async () => {
    fetchMock.mockResolvedValue(
      new Response("Gateway timeout", { status: 504 }),
    );
    const client = createClient("https://example.supabase.co", "test-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: fetchWithGatewayRetry },
    });
    const result = await client.rpc("confirm_campaign", {
      p_approval_id: "saved-approval",
    });
    expect(result.error).not.toBeNull();
    expect(result.status).toBe(504);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.method).toBe("POST");
  });

  it.each([400, 401, 403, 404, 409, 422])(
    "does not retry HTTP %s",
    async (status) => {
      fetchMock.mockResolvedValue(new Response(null, { status }));
      expect((await fetchWithGatewayRetry(url)).status).toBe(status);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("stops waiting and making requests when the read is aborted", async () => {
    const controller = new AbortController();
    fetchMock.mockResolvedValue(new Response(null, { status: 504 }));
    const result = fetchWithGatewayRetry(
      new Request(url, { signal: controller.signal }),
    );
    const assertion = expect(result).rejects.toMatchObject({
      name: "AbortError",
    });
    await vi.advanceTimersByTimeAsync(10);
    controller.abort();
    await assertion;
    await vi.runAllTimersAsync();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("lets the SDK handle network failures without multiplying its retry policy", async () => {
    const failure = new TypeError("fetch failed");
    fetchMock.mockRejectedValue(failure);
    await expect(fetchWithGatewayRetry(url)).rejects.toBe(failure);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
