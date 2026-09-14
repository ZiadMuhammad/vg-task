"use server";

import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth";

export type GoogleLinkState = { error?: string };

export async function connectGoogle(): Promise<GoogleLinkState> {
  if (process.env.GOOGLE_AUTH_ENABLED !== "true")
    return { error: "Google sign-in is currently unavailable." };

  const { supabase, user } = await requireMembership();
  if (user.identities?.some((identity) => identity.provider === "google"))
    return { error: "Google is already connected to this account." };

  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) return { error: "Google sign-in is temporarily unavailable." };

  // linkIdentity uses the authenticated user's session. No client-supplied
  // user, email, brand or role can choose the account receiving this identity.
  const { data, error } = await supabase.auth.linkIdentity({
    provider: "google",
    options: {
      redirectTo: new URL("/auth/link/callback", site).toString(),
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url)
    return {
      error:
        "We couldn’t connect Google. Try again, or contact your administrator if this Google account is already in use.",
    };
  redirect(data.url);
}
