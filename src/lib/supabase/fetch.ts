const gatewayErrors = new Set([502, 504]);
const retryDelays = [250, 750];

function wait(ms: number, signal?: AbortSignal | null) {
  return new Promise<void>((resolve, reject) => {
    signal?.throwIfAborted();
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    function abort() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(signal?.reason);
    }
    signal?.addEventListener("abort", abort, { once: true });
  });
}

/** The SDK retries network failures and 503/520, but omits gateway timeouts. */
export const fetchWithGatewayRetry: typeof fetch = async (input, init) => {
  const method = (
    init?.method ?? (input instanceof Request ? input.method : "GET")
  ).toUpperCase();
  // An explicit signal opts out of Next's render-time fetch memoization. A retry
  // must reach Supabase again rather than reuse the first failed response.
  const signal =
    init?.signal ??
    (input instanceof Request ? input.signal : new AbortController().signal);
  const path = new URL(input instanceof Request ? input.url : String(input))
    .pathname;
  const canRetry = method === "GET" || method === "HEAD";

  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted();
    const response = await fetch(input, { ...init, signal, cache: "no-store" });
    if (!response.ok) {
      // No URLs with filters, headers, response bodies, or customer data in logs.
      console.warn("Supabase request failed", {
        method,
        path,
        status: response.status,
        attempt: attempt + 1,
      });
    }
    if (
      !canRetry ||
      !gatewayErrors.has(response.status) ||
      attempt >= retryDelays.length
    )
      return response;

    // Drain rather than cancel: cancellation can hang on a cloned response body.
    await response.arrayBuffer();
    await wait(retryDelays[attempt], signal);
  }
};
