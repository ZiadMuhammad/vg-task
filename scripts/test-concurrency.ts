import postgres from "postgres";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** This suite commits fixtures across connections, so it requires a fresh, local database. */
export async function testConcurrentApproval(url: string) {
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname))
    throw new Error("Concurrency fixtures require a local database");
  const sql = postgres(url, { max: 2, onnotice: () => {} });
  const campaign = "dddddddd-0000-4000-8000-000000000004";
  const owner = "dddddddd-0000-4000-8000-000000000001";
  let installed = false;
  try {
    const [state] =
      await sql`select count(*)::int as memberships from public.memberships`;
    assert.equal(
      state.memberships,
      0,
      "Use a fresh local database for committed concurrency fixtures",
    );
    const fixture = (
      await readFile("tests/integration/dispatch.sql", "utf8")
    ).split("set local role authenticated;")[0];
    await sql.begin((tx) => tx.unsafe(fixture.replace("begin;", "")));
    installed = true;
    const [preview] = await sql.begin(async (tx) => {
      await tx`set local role authenticated`;
      await tx`select set_config('request.jwt.claim.sub',${owner},true)`;
      return tx`select public.prepare_campaign(${campaign}::uuid) as id`;
    });
    const [approval] =
      await sql`select id,recipient_count,audience_hash from public.campaign_approvals where id=${preview.id}`;
    const confirm = () =>
      sql.begin(async (tx) => {
        await tx`set local role authenticated`;
        await tx`select set_config('request.jwt.claim.sub',${owner},true)`;
        return tx`select public.confirm_campaign(${approval.id}::uuid,${approval.recipient_count}::int,${approval.audience_hash}) as id`;
      });
    const results = await Promise.all([confirm(), confirm()]);
    assert.equal(results[0][0].id, approval.id);
    assert.equal(results[1][0].id, approval.id);
    const [counts] =
      await sql`select (select count(*)::int from public.provider_batches where approval_id=${approval.id}) as batches,(select count(*)::int from pgmq.q_campaign_dispatch) as queued`;
    assert.deepEqual({ ...counts }, { batches: 1, queued: 1 });
    console.log(
      "Two concurrent database sessions created exactly one approval and queued batch.",
    );
  } finally {
    if (installed) {
      // Immutable history can only be removed by explicitly disabling guards in this disposable test DB.
      // The transaction holds table locks until all guards are restored.
      await sql.begin(async (tx) => {
        await tx.unsafe(
          "alter table public.campaign_approvals disable trigger protect_approval; alter table public.approved_recipients disable trigger protect_recipient_delete; alter table private.batch_work disable trigger protect_payload;",
        );
        await tx`delete from private.batch_work where batch_id in(select b.id from public.provider_batches b join public.campaign_approvals a on a.id=b.approval_id where a.campaign_id=${campaign})`;
        await tx`delete from pgmq.q_campaign_dispatch where (message->>'batch_id')::uuid in(select b.id from public.provider_batches b join public.campaign_approvals a on a.id=b.approval_id where a.campaign_id=${campaign})`;
        await tx`delete from public.provider_batches where approval_id in(select id from public.campaign_approvals where campaign_id=${campaign})`;
        await tx`delete from public.campaign_approvals where campaign_id=${campaign}`;
        await tx`delete from public.campaigns where id=${campaign}`;
        await tx`delete from public.contacts where import_run_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'`;
        await tx`delete from public.import_runs where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'`;
        await tx`delete from auth.users where id in('dddddddd-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-000000000002')`;
        await tx.unsafe(
          "alter table public.campaign_approvals enable trigger protect_approval; alter table public.approved_recipients enable trigger protect_recipient_delete; alter table private.batch_work enable trigger protect_payload;",
        );
      });
    }
    await sql.end();
  }
}
