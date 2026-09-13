import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
/** Only narrow shared-report operations use this client; portal data uses the caller's JWT. */
export function createReportClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Report service is unavailable");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
