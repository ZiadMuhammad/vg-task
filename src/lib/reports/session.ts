import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
const schema = z
  .object({
    reportId: z.uuid(),
    version: z.number().int().positive(),
    expiresAt: z.number().int().positive(),
  })
  .strict();
export type ReportSession = z.infer<typeof schema>;
export function signReportSession(session: ReportSession, secret: string) {
  const payload = Buffer.from(JSON.stringify(schema.parse(session))).toString(
    "base64url",
  );
  return (
    payload +
    "." +
    createHmac("sha256", secret).update(payload).digest("base64url")
  );
}
export function verifyReportSession(
  value: string | undefined,
  reportId: string,
  secret: string,
  now: number,
): ReportSession | null {
  if (!value || value.length > 1024) return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expected = createHmac("sha256", secret).update(payload).digest();
  const supplied = Buffer.from(signature, "base64url");
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    return null;
  try {
    const parsed = schema.safeParse(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
    );
    return parsed.success &&
      parsed.data.reportId === reportId &&
      parsed.data.expiresAt > now
      ? parsed.data
      : null;
  } catch {
    return null;
  }
}
export function reportAttemptKey(ip: string, secret: string) {
  return createHmac("sha256", secret)
    .update("report-attempt:" + ip)
    .digest("hex");
}
