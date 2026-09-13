"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };

export async function login(
  _: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = z
    .object({ email: z.email().max(254), password: z.string().min(1).max(256) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: "Enter a valid email address and password." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error)
    return {
      error:
        "We couldn’t sign you in. Check your email and password, or try again shortly.",
    };
  const { data, error: membershipError } = await supabase
    .from("memberships")
    .select("user_id")
    .maybeSingle();
  if (membershipError)
    return { error: "We couldn’t check your access. Please try again." };
  if (!data) {
    await supabase.auth.signOut();
    return {
      error:
        "This account hasn’t been assigned to a brand. Contact your administrator.",
    };
  }
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
