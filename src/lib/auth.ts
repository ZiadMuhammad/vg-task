import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const requireMembership = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");
  const { data, error } = await supabase
    .from("memberships")
    .select("user_id, brand_id, role, display_name, brands(*)")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error)
    throw new Error("We could not verify your brand access. Please try again.");
  if (!data?.brands) redirect("/login?error=access");
  return { supabase, user, membership: data, brand: data.brands };
});
