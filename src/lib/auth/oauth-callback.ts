import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function completeOAuthCallback(
  request: Request,
  destination: "/dashboard" | "/account",
) {
  const url = new URL(request.url);
  const failure =
    destination === "/account"
      ? "/account?error=google"
      : "/login?error=callback";
  const go = (path: string) => {
    const response = NextResponse.redirect(new URL(path, url.origin));
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  };
  const code = url.searchParams.get("code");
  if (!code || url.searchParams.has("error")) return go(failure);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return go(failure);

  // The exchanged identity is verified by Auth; brand access still comes from
  // the existing membership. Never create or reassign a membership from OAuth.
  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (membershipError) return go("/login?error=service");
  if (!membership) {
    await supabase.auth.signOut({ scope: "local" });
    return go("/login?error=access");
  }
  return go(destination);
}
