"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createReportClient } from "@/lib/supabase/admin";
import { reportSecret } from "@/lib/reports/data";
import { reportAttemptKey, signReportSession } from "@/lib/reports/session";
export type UnlockState = { error?: string };
const unlockError =
  "Unable to unlock this report. Check the password or try again in 15 minutes.";
export async function unlockReport(
  _: UnlockState,
  form: FormData,
): Promise<UnlockState> {
  const parsed = z
    .object({ id: z.uuid(), password: z.string().min(12).max(64) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: unlockError };
  const incoming = await headers();
  const ip =
    incoming.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unavailable";
  const secret = reportSecret();
  const { data, error } = await createReportClient().rpc(
    "verify_report_password",
    {
      p_report_id: parsed.data.id,
      p_password: parsed.data.password,
      p_attempt_key: reportAttemptKey(ip, secret),
    },
  );
  if (error)
    return {
      error:
        "The report service is temporarily unavailable. Please try again shortly.",
    };
  const verified = z
    .object({ report_id: z.uuid(), version: z.number().int().positive() })
    .safeParse(data);
  if (!verified.success || verified.data.report_id !== parsed.data.id)
    return { error: unlockError };
  const expiresAt = Date.now() + 3600_000;
  (await cookies()).set(
    "vg_report_session",
    signReportSession(
      {
        reportId: verified.data.report_id,
        version: verified.data.version,
        expiresAt,
      },
      secret,
    ),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: `/share/${parsed.data.id}`,
      maxAge: 3600,
    },
  );
  redirect(`/share/${parsed.data.id}`);
}
