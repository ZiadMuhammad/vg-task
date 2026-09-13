import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const accounts: {
  email: string;
  password: string;
  brand_id: string;
  id: string;
}[] = JSON.parse(await readFile(".local/test-accounts.json", "utf8"));
for (const account of accounts) {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  assert.equal(error, null, "Password authentication failed");
  const brands = await client.from("brands").select("id");
  assert.equal(brands.error, null);
  assert.deepEqual(brands.data, [{ id: account.brand_id }]);
  const other = await client
    .from("brands")
    .select("id")
    .neq("id", account.brand_id);
  assert.equal(other.error, null);
  assert.deepEqual(other.data, []);
  const membership = await client.from("memberships").select("user_id");
  assert.equal(membership.error, null);
  assert.deepEqual(membership.data, [{ user_id: account.id }]);
  const write = await client
    .from("memberships")
    .update({ role: "owner" })
    .eq("user_id", account.id);
  assert.equal(
    write.error?.code,
    "42501",
    "Client was able to change authorization",
  );
  for (const table of [
    "contacts",
    "contactability",
    "campaigns",
    "campaign_metrics",
    "import_runs",
    "import_issues",
    "imported_events",
    "historical_sends",
    "campaign_approvals",
    "approved_recipients",
    "provider_batches",
    "provider_events",
    "provider_event_issues",
    "dispatch_metrics",
  ]) {
    const crossBrand = await client
      .from(table)
      .select("brand_id")
      .neq("brand_id", account.brand_id)
      .limit(1);
    assert.equal(crossBrand.error, null, `${table} read failed`);
    assert.deepEqual(crossBrand.data, [], `${table} leaked another brand`);
  }
  const search = await client.rpc("search_contacts", {
    p_query: "",
    p_page: 1,
  });
  assert.equal(search.error, null, "Search RPC failed");
  assert.ok(search.data.rows.length <= 50, "Search returned unbounded rows");
  const summary = await client.rpc("dashboard_summary");
  assert.equal(summary.error, null, "Dashboard RPC failed");
  const ownCustomers = await client
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);
  assert.equal(ownCustomers.error, null);
  assert.equal(
    summary.data.totals.customers,
    ownCustomers.count,
    "Dashboard returned another brand's total",
  );
  assert.equal(summary.data.signups.length, 30, "Dashboard omitted UTC days");
  const importer = await client.rpc("ingest_contacts", {
    p_brand_id: account.brand_id,
    p_rows: [],
  });
  assert.equal(
    importer.error?.code,
    "42501",
    "User can call privileged importer",
  );
  const worker = await client.rpc("claim_dispatch");
  assert.equal(
    worker.error?.code,
    "42501",
    "Portal user acquired worker access",
  );
  const approvalWrite = await client
    .from("campaign_approvals")
    .update({ recipient_count: 0 })
    .eq("brand_id", account.brand_id);
  assert.equal(
    approvalWrite.error?.code,
    "42501",
    "Portal user directly rewrote an approval",
  );
  await client.auth.signOut({ scope: "local" });
}
const anonymous = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
);
const read = await anonymous.from("brands").select("*");
assert.equal(read.error?.code, "42501", "Anonymous table access granted");
console.log(
  "All six password accounts passed direct REST brand, membership, and write-denial checks. Anonymous reads denied.",
);
