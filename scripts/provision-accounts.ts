import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const brands = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "kilele",
    name: "Kilele",
  },
  { id: "22222222-2222-4222-8222-222222222222", slug: "karoo", name: "Karoo" },
  {
    id: "33333333-3333-4333-8333-333333333333",
    slug: "marrakech",
    name: "Marrakech",
  },
];
type Account = {
  id: string;
  email: string;
  password: string;
  role: string;
  brand_id: string;
};
const path = ".local/test-accounts.json";
let accounts: Account[] = [];
try {
  accounts = JSON.parse(await readFile(path, "utf8"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
await mkdir(".local", { recursive: true });
for (const brand of brands) {
  for (const role of ["owner", "analyst"]) {
    const email = `${brand.slug}.${role}@demo.velocity.example`;
    // Google setup may replace a demo email without changing its membership.
    let account = accounts.find(
      (entry) => entry.brand_id === brand.id && entry.role === role,
    );
    if (!account) {
      const password = randomBytes(24).toString("base64url");
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !data.user)
        throw new Error(error?.message ?? "Account creation returned no user");
      account = { id: data.user.id, email, password, role, brand_id: brand.id };
      accounts.push(account);
      // Save after each creation so interruption never loses an account's password.
      await writeFile(path, JSON.stringify(accounts, null, 2) + "\n", {
        mode: 0o600,
      });
    }
    const { error } = await supabase.from("memberships").upsert(
      {
        user_id: account.id,
        brand_id: brand.id,
        role,
        display_name: `${brand.name} ${role === "owner" ? "Owner" : "Analyst"}`,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
  }
}
console.log(
  `Provisioned ${accounts.length} accounts. Credentials are in ignored ${path}.`,
);
