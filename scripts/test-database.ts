import postgres from "postgres";
import { readFile, readdir } from "node:fs/promises";

const url =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname))
  throw new Error(
    "Use a local test database. Hosted checks must use an explicitly reviewed transaction.",
  );
const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  const source = await readFile("tests/integration/isolation.sql", "utf8");
  for (const file of (await readdir("tests/integration"))
    .filter((file) => file.endsWith(".sql"))
    .sort()) {
    await sql.unsafe(await readFile(`tests/integration/${file}`, "utf8"));
    console.log(`${file}: passed`);
  }
  console.log("Database authorization assertions passed.");
  // A real mutation check proves the assertions detect the missing boundary.
  const mutated = source.replace(
    "begin;",
    "begin;\nalter table public.brands disable row level security;",
  );
  let detected = false;
  try {
    await sql.unsafe(mutated);
  } catch (error) {
    detected =
      error instanceof Error && error.message.includes("RLS isolation broken");
  } finally {
    await sql.unsafe("rollback");
  }
  if (!detected) throw new Error("Isolation test did not detect disabled RLS.");
  console.log("Disabling RLS was detected by the same test.");
} finally {
  await sql.end();
}
