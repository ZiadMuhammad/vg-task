import { describe, expect, it } from "vitest";
import {
  reportAttemptKey,
  signReportSession,
  verifyReportSession,
} from "../../src/lib/reports/session";
const secret = "a-secure-test-only-session-signing-key";
const session = {
  reportId: "11111111-1111-4111-8111-111111111111",
  version: 1,
  expiresAt: 2000,
};
describe("shared report sessions", () => {
  it("binds a signed session to one report and its expiry", () => {
    const value = signReportSession(session, secret);
    expect(verifyReportSession(value, session.reportId, secret, 1000)).toEqual(
      session,
    );
    expect(
      verifyReportSession(
        value,
        "22222222-2222-4222-8222-222222222222",
        secret,
        1000,
      ),
    ).toBeNull();
    expect(
      verifyReportSession(value, session.reportId, secret, 2000),
    ).toBeNull();
  });
  it("rejects forged, malformed and modified sessions", () => {
    const value = signReportSession(session, secret);
    for (const token of [
      undefined,
      "",
      value + "x",
      value.replace(value[0], "x"),
      "hello.world",
      value + ".extra",
      "x".repeat(1025),
    ])
      expect(
        verifyReportSession(token, session.reportId, secret, 1000),
      ).toBeNull();
    expect(
      verifyReportSession(value, session.reportId, "different-key", 1000),
    ).toBeNull();
  });
  it("stores only a keyed hash for attempt accounting", () => {
    expect(reportAttemptKey("192.0.2.1", secret)).toMatch(/^[a-f0-9]{64}$/);
    expect(reportAttemptKey("192.0.2.1", secret)).not.toEqual(
      reportAttemptKey("192.0.2.1", "different-key"),
    );
  });
});
