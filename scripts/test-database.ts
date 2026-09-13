import postgres from "postgres";
import { testConcurrentApproval } from "./test-concurrency";
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
  for (const file of (await readdir("tests/integration"))
    .filter((file) => file.endsWith(".sql"))
    .sort()) {
    await sql.unsafe(await readFile(`tests/integration/${file}`, "utf8"));
    console.log(`${file}: passed`);
  }
  console.log("Database authorization assertions passed.");
  // Prove the same assertions detect an actual removal of each boundary.
  for (const mutation of [
    {
      file: "isolation.sql",
      change: "alter table public.brands disable row level security;",
      expected: "RLS isolation broken",
    },
    {
      file: "function-permissions.sql",
      change:
        "grant execute on function public.read_shared_report(uuid,integer) to authenticated;",
      expected: "Server-only function execution granted",
    },
  ]) {
    const source = await readFile(`tests/integration/${mutation.file}`, "utf8");
    let detected = false;
    try {
      await sql.unsafe(source.replace("begin;", `begin;\n${mutation.change}`));
    } catch (error) {
      detected =
        error instanceof Error && error.message.includes(mutation.expected);
    } finally {
      await sql.unsafe("rollback");
    }
    if (!detected)
      throw new Error(`${mutation.file} did not detect the removed boundary.`);
    console.log(`${mutation.file}: removed boundary detected.`);
  }
} finally {
  await sql.end();
}

await testConcurrentApproval(url);
