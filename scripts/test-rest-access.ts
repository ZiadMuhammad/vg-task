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
  await client.auth.signOut();
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
