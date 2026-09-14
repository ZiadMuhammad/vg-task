import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exchange: vi.fn(),
  signOut: vi.fn(),
  membership: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  linkIdentity: vi.fn(),
  requireMembership: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { exchangeCodeForSession: mocks.exchange, signOut: mocks.signOut },
    from: mocks.from,
  }),
}));
vi.mock("@/lib/auth", () => ({ requireMembership: mocks.requireMembership }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { GET as signInCallback } from "../../src/app/auth/callback/route";
import { GET as linkCallback } from "../../src/app/auth/link/callback/route";
import { connectGoogle } from "../../src/app/(portal)/account/actions";

const userId = "11111111-2222-4333-8444-555555555555";
const origin = "https://portal.example.test";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("GOOGLE_AUTH_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", origin);
  mocks.exchange.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.membership.mockResolvedValue({
    data: { user_id: userId },
    error: null,
  });
  mocks.eq.mockReturnValue({ maybeSingle: mocks.membership });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.requireMembership.mockResolvedValue({
    supabase: { auth: { linkIdentity: mocks.linkIdentity } },
    user: { id: userId, identities: [{ provider: "email" }] },
  });
  mocks.linkIdentity.mockResolvedValue({
    data: { url: "https://accounts.google.com/example-authorization" },
    error: null,
  });
  mocks.redirect.mockImplementation((url: string) => {
    throw new Error(`redirect:${url}`);
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("Google callback authorization", () => {
  it("resolves brand access through the verified identity's existing membership", async () => {
    const response = await signInCallback(
      new Request(`${origin}/auth/callback?code=valid`),
    );
    expect(response.headers.get("location")).toBe(`${origin}/dashboard`);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(mocks.eq).toHaveBeenCalledWith("user_id", userId);
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("rejects an unassigned Google identity even when it claims a brand in editable metadata", async () => {
    mocks.exchange.mockResolvedValue({
      data: {
        user: {
          id: userId,
          user_metadata: { role: "owner", brand_id: "another-brand" },
        },
      },
      error: null,
    });
    mocks.membership.mockResolvedValue({ data: null, error: null });
    const response = await signInCallback(
      new Request(`${origin}/auth/callback?code=valid`),
    );
    expect(response.headers.get("location")).toBe(
      `${origin}/login?error=access`,
    );
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledWith("memberships");
  });

  it("treats an access-query failure as a service failure, preserving the authenticated session", async () => {
    mocks.membership.mockResolvedValue({ data: null, error: { code: "504" } });
    const response = await signInCallback(
      new Request(`${origin}/auth/callback?code=valid`),
    );
    expect(response.headers.get("location")).toBe(
      `${origin}/login?error=service`,
    );
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it.each([
    "",
    "?error=access_denied&error_description=private-details",
    "?code=valid&error=access_denied",
  ])(
    "handles missing/cancelled callbacks without exchanging a code: %s",
    async (query) => {
      const response = await signInCallback(
        new Request(`${origin}/auth/callback${query}`),
      );
      expect(response.headers.get("location")).toBe(
        `${origin}/login?error=callback`,
      );
      expect(mocks.exchange).not.toHaveBeenCalled();
      expect(mocks.from).not.toHaveBeenCalled();
    },
  );

  it("rejects expired or failed code exchanges before loading any portal data", async () => {
    mocks.exchange.mockResolvedValue({
      data: { user: null },
      error: { message: "private-details" },
    });
    const response = await signInCallback(
      new Request(`${origin}/auth/callback?code=expired`),
    );
    expect(response.headers.get("location")).toBe(
      `${origin}/login?error=callback`,
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("uses fixed internal destinations and ignores a supplied external redirect", async () => {
    const response = await linkCallback(
      new Request(
        `${origin}/auth/link/callback?code=valid&next=https://attacker.example`,
      ),
    );
    expect(response.headers.get("location")).toBe(`${origin}/account`);
    expect(mocks.eq).toHaveBeenCalledWith("user_id", userId);
  });

  it("returns cancelled linking to Account without signing the password session out", async () => {
    const response = await linkCallback(
      new Request(`${origin}/auth/link/callback?error=access_denied`),
    );
    expect(response.headers.get("location")).toBe(
      `${origin}/account?error=google`,
    );
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});

describe("Connecting Google to an existing portal account", () => {
  it("requires a verified membership before starting identity linking", async () => {
    mocks.requireMembership.mockRejectedValue(new Error("Access denied"));
    await expect(connectGoogle()).rejects.toThrow("Access denied");
    expect(mocks.linkIdentity).not.toHaveBeenCalled();
  });

  it("uses the caller's authenticated client, with no supplied user or role assignment", async () => {
    await expect(connectGoogle()).rejects.toThrow(
      "redirect:https://accounts.google.com/example-authorization",
    );
    expect(mocks.requireMembership).toHaveBeenCalledOnce();
    expect(mocks.linkIdentity).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/link/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
  });

  it("enforces the feature flag on the server", async () => {
    vi.stubEnv("GOOGLE_AUTH_ENABLED", "false");
    expect(await connectGoogle()).toHaveProperty("error");
    expect(mocks.linkIdentity).not.toHaveBeenCalled();
  });

  it("does not replace an existing Google connection", async () => {
    mocks.requireMembership.mockResolvedValue({
      supabase: { auth: { linkIdentity: mocks.linkIdentity } },
      user: { id: userId, identities: [{ provider: "google" }] },
    });
    expect(await connectGoogle()).toEqual({
      error: "Google is already connected to this account.",
    });
    expect(mocks.linkIdentity).not.toHaveBeenCalled();
  });

  it("shows a safe error instead of redirecting when the provider fails", async () => {
    mocks.linkIdentity.mockResolvedValue({
      data: { url: null },
      error: { message: "private-provider-detail" },
    });
    const result = await connectGoogle();
    expect(result.error).toContain("We couldn’t connect Google");
    expect(result.error).not.toContain("private-provider-detail");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
