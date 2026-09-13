import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { parseExport } from "../src/lib/imports/csv";
import {
  clean,
  country,
  date,
  identifier,
  integer,
  InvalidRow,
  mergeDuplicateContact,
  minorUnits,
  normalizeContact,
  validateText,
  type ContactRecord,
  type Issue,
  type SourceRow,
} from "../src/lib/imports/normalize";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const directory = resolve(
  process.argv.find((arg) => arg.startsWith("--directory="))?.split("=")[1] ??
    ".data",
);
const force = process.argv.includes("--force");
const selectedBrand = process.argv
  .find((arg) => arg.startsWith("--brand="))
  ?.split("=")[1];
const brands = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    code: "KILELE",
    slug: "kilele",
  },
  { id: "22222222-2222-4222-8222-222222222222", code: "KAROO", slug: "karoo" },
  {
    id: "33333333-3333-4333-8333-333333333333",
    code: "MARRAKECH",
    slug: "marrakech",
  },
];
type Brand = (typeof brands)[number];
type Kind = "contacts" | "campaigns" | "events" | "send_log";
type DbRow = Record<string, unknown>;
type Reference = { id: string; external_id: string; channel?: string };
async function batches<T>(
  rows: T[],
  action: (chunk: T[]) => Promise<void>,
  size = 500,
) {
  for (let offset = 0; offset < rows.length; offset += size * 2) {
    await Promise.all(
      [0, size]
        .filter((step) => offset + step < rows.length)
        .map((step) => action(rows.slice(offset + step, offset + step + size))),
    );
  }
}
async function upsert(
  table: string,
  rows: DbRow[],
  onConflict: string,
  ignoreDuplicates = false,
) {
  await batches(rows, async (chunk) => {
    const { error } = await db
      .from(table)
      .upsert(chunk, { onConflict, ignoreDuplicates });
    if (error) throw new Error(`${table}: ${error.message}`);
  });
}
async function references(table: "contacts" | "campaigns", brandId: string) {
  const result = new Map<string, Reference>();
  let cursor = "";
  while (true) {
    const { data, error } = await db
      .from(table)
      .select(
        table === "campaigns" ? "id,external_id,channel" : "id,external_id",
      )
      .eq("brand_id", brandId)
      .gt("external_id", cursor)
      .order("external_id")
      .limit(1000);
    if (error) throw new Error(error.message);
    const rows = data as unknown as Reference[];
    rows.forEach((row) => result.set(row.external_id, row));
    if (rows.length < 1000) break;
    cursor = rows[rows.length - 1].external_id;
  }
  return result;
}
async function reconcile(brandId: string) {
  let cursor: string | null = null;
  while (true) {
    const result: { data: unknown; error: { message: string } | null } =
      await db.rpc("reconcile_import_page", {
        p_brand_id: brandId,
        p_after: cursor,
      });
    if (result.error) throw new Error(result.error.message);
    const page = z
      .object({
        processed: z.number().int().nonnegative(),
        cursor: z.uuid().nullable(),
      })
      .parse(result.data);
    if (page.processed === 0) break;
    if (!page.cursor || page.cursor === cursor)
      throw new Error("Reconciliation did not advance its checkpoint.");
    cursor = page.cursor;
  }
}

function campaign(row: SourceRow, issues: Issue[]) {
  const channel = clean(row.channel).toLowerCase();
  if (!["email", "sms"].includes(channel))
    throw new InvalidRow(
      "invalid_channel",
      "Campaign channel must be email or SMS.",
    );
  const name = clean(row.campaign_name);
  if (!name || name.length > 200)
    throw new InvalidRow(
      "invalid_name",
      "Campaign name is missing or too long.",
    );
  const target = country(row.target_country);
  if (clean(row.target_country) && !target)
    throw new InvalidRow(
      "invalid_target",
      "Target country is not recognized; audience must not broaden silently.",
    );
  const result = {
    external_id: identifier(row.external_id),
    name,
    channel,
    target_country: target,
    reported_sent: integer(row.reported_sent, "reported_sent"),
    reported_delivered: integer(row.reported_delivered, "reported_delivered"),
    reported_bounced: integer(row.reported_bounced, "reported_bounced"),
    reported_opens: integer(row.reported_opens, "reported_opens"),
    reported_clicks: integer(row.reported_clicks, "reported_clicks"),
    spend_minor: minorUnits(row.spend),
    sent_at: date(row.sent_at_utc, "sent_at_utc", issues, true),
    source_local_time: clean(row.send_local_time) || null,
    parent_external_id: clean(row.parent_campaign_id) || null,
  };
  if (
    result.reported_delivered + result.reported_bounced !==
    result.reported_sent
  )
    issues.push({
      code: "reported_totals_disagree",
      message:
        "Reported delivery plus bounces differs from reported sends; source totals retained separately.",
      severity: "warning",
    });
  if (
    result.reported_opens > result.reported_delivered ||
    (channel === "sms" && result.reported_opens > 0)
  )
    issues.push({
      code: "ambiguous_opens",
      message:
        "Reported opens may be repeated events or unsupported by the channel. Retained as source counts, not a unique open rate.",
      severity: "warning",
    });
  return result;
}
async function importFile(
  brand: Brand,
  filename: string,
  kind: Kind,
  contacts: Map<string, Reference>,
  campaigns: Map<string, Reference>,
) {
  const buffer = await readFile(resolve(directory, filename));
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const previous = await db
    .from("import_runs")
    .select("id,status,total_rows,accepted_rows,rejected_rows,duplicate_rows")
    .eq("brand_id", brand.id)
    .eq("file_name", filename)
    .eq("sha256", sha256)
    .maybeSingle();
  if (previous.error) throw new Error(previous.error.message);
  if (previous.data?.status === "complete" && !force) {
    console.log(`${filename}: already imported; skipped.`);
    return;
  }
  const checkpoint = previous.data;
  if (
    !force &&
    checkpoint &&
    checkpoint.total_rows > 0 &&
    checkpoint.accepted_rows +
      checkpoint.rejected_rows +
      checkpoint.duplicate_rows ===
      checkpoint.total_rows
  ) {
    // Counts are checkpointed only after every row batch is durable.
    console.log(`${filename}: resuming final reconciliation…`);
    if (kind === "events") await reconcile(brand.id);
    const { error } = await db
      .from("import_runs")
      .update({
        status: "complete",
        error: null,
        finished_at: new Date().toISOString(),
      })
      .eq("id", checkpoint.id);
    if (error) throw new Error(error.message);
    console.log(`${filename}: reconciliation complete.`);
    return;
  }
  const parsed = parseExport(buffer, brand.slug === "marrakech" ? ";" : ",");
  const run = await db
    .from("import_runs")
    .upsert(
      {
        brand_id: brand.id,
        file_name: filename,
        sha256,
        kind,
        encoding: parsed.encoding,
        status: "running",
        total_rows: parsed.rows.length,
        accepted_rows: 0,
        rejected_rows: 0,
        duplicate_rows: 0,
        warning_rows: 0,
        error: null,
        finished_at: null,
      },
      { onConflict: "brand_id,file_name,sha256" },
    )
    .select("id")
    .single();
  if (run.error) throw new Error(run.error.message);
  const runId = run.data.id as string;
  console.log(`${filename}: validating ${parsed.rows.length} source rows…`);
  const records = new Map<string, DbRow>();
  const issues: DbRow[] = [];
  const warned = new Set<number>();
  let rejected = 0,
    duplicates = 0;
  const addIssue = (issue: Issue, line: number, row: SourceRow) => {
    if (issue.severity === "warning") warned.add(line);
    issues.push({
      brand_id: brand.id,
      import_run_id: runId,
      row_number: line,
      ...issue,
      external_id: row.external_id ?? row.event_id ?? row.batch_key ?? null,
      raw: Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          key,
          value.replaceAll("\u0000", "\\u0000"),
        ]),
      ),
    });
  };
  try {
    for (const { row, line, columnMismatch } of parsed.rows) {
      const warnings: Issue[] = [];
      try {
        validateText(row);
        if (columnMismatch)
          throw new InvalidRow(
            "column_count",
            "Row has a different number of columns from the header.",
          );
        let record: DbRow;
        let key: string;
        if (kind === "contacts") {
          const normalized = normalizeContact(row, brand.code);
          warnings.push(...normalized.issues);
          record = {
            ...normalized.record,
            source_priority: filename.includes("delta") ? 2 : 1,
          };
          key = normalized.record.external_id;
        } else if (kind === "campaigns") {
          record = campaign(row, warnings);
          key = record.external_id as string;
        } else if (kind === "events") {
          key = identifier(row.event_id, "event_id");
          const contact = contacts.get(clean(row.external_contact_id));
          if (!contact)
            throw new InvalidRow(
              "missing_contact",
              "Event references a customer absent from this brand's valid contacts.",
            );
          const matchedCampaign = campaigns.get(
            clean(row.campaign_external_id),
          );
          const channel = clean(row.channel).toLowerCase();
          const eventType = clean(row.event_type).toLowerCase();
          if (
            !["email", "sms"].includes(channel) ||
            !["open", "click", "bounce", "unsubscribe", "complaint"].includes(
              eventType,
            )
          )
            throw new InvalidRow(
              "invalid_event",
              "Event type or channel is not recognized.",
            );
          const attributed = Boolean(
            matchedCampaign && matchedCampaign.channel === channel,
          );
          if (!attributed)
            warnings.push({
              code: matchedCampaign ? "channel_mismatch" : "missing_campaign",
              message: `${matchedCampaign ? "Channel differs from the campaign" : "Campaign is missing in this brand"}. Excluded from campaign engagement; adverse events still suppress the known customer.`,
              severity: "warning",
            });
          record = {
            event_id: key,
            contact_id: contact.id,
            campaign_id: matchedCampaign?.id ?? null,
            campaign_external_id: identifier(row.campaign_external_id),
            event_type: eventType,
            channel,
            occurred_at: date(
              row.occurred_at_utc,
              "occurred_at_utc",
              warnings,
              true,
            ),
            attributed,
          };
        } else {
          key = identifier(row.batch_key, "batch_key");
          const matchedCampaign = campaigns.get(
            clean(row.campaign_external_id),
          );
          if (!matchedCampaign)
            throw new InvalidRow(
              "missing_campaign",
              "Send log references a campaign absent from this brand.",
            );
          if (
            !["sent", "queued", "failed", "sending"].includes(clean(row.status))
          )
            throw new InvalidRow(
              "invalid_status",
              "Historical send status is not recognized.",
            );
          record = {
            batch_key: key,
            campaign_id: matchedCampaign.id,
            queued_at: date(row.queued_at_utc, "queued_at_utc", warnings, true),
            recipient_count: integer(row.recipient_count, "recipient_count"),
            status: clean(row.status),
          };
        }
        if (records.has(key)) {
          const previous = records.get(key)!;
          if (kind === "contacts") {
            record = {
              ...record,
              ...mergeDuplicateContact(
                previous as unknown as ContactRecord,
                record as unknown as ContactRecord,
              ),
            };
          } else if (
            JSON.stringify(previous) !==
            JSON.stringify({
              ...record,
              brand_id: brand.id,
              import_run_id: runId,
            })
          ) {
            throw new InvalidRow(
              "conflicting_duplicate",
              "A different valid record already uses this ID. First record retained; conflicting record rejected.",
            );
          }
          duplicates++;
          warnings.push({
            code: "duplicate_id",
            message:
              kind === "contacts"
                ? "Repeated customer ID merged; latest attributes and most restrictive consent/status in this export retained."
                : "Repeated record ID ignored; one record retained.",
            severity: "warning",
          });
        }
        records.set(key, {
          ...record,
          brand_id: brand.id,
          import_run_id: runId,
        });
        warnings.forEach((issue) => addIssue(issue, line, row));
      } catch (error) {
        if (!(error instanceof InvalidRow)) throw error;
        rejected++;
        addIssue(
          { code: error.code, message: error.message, severity: "error" },
          line,
          row,
        );
      }
    }
    await upsert(
      "import_issues",
      issues,
      "import_run_id,row_number,code",
      true,
    );
    const rows = [...records.values()];
    if (kind === "contacts") {
      await batches(
        rows,
        async (chunk) => {
          const { error } = await db.rpc("ingest_contacts", {
            p_brand_id: brand.id,
            p_rows: chunk,
          });
          if (error) throw new Error(error.message);
        },
        200,
      );
    } else {
      const table = {
        campaigns: "campaigns",
        events: "imported_events",
        send_log: "historical_sends",
      }[kind];
      const key = {
        campaigns: "external_id",
        events: "event_id",
        send_log: "batch_key",
      }[kind];
      await upsert(table, rows, `brand_id,${key}`, true);
    }
    const checkpointResult = await db
      .from("import_runs")
      .update({
        accepted_rows: records.size,
        rejected_rows: rejected,
        duplicate_rows: duplicates,
        warning_rows: warned.size,
      })
      .eq("id", runId);
    if (checkpointResult.error) throw new Error(checkpointResult.error.message);
    if (kind === "events") await reconcile(brand.id);
    const done = await db
      .from("import_runs")
      .update({
        status: "complete",
        accepted_rows: records.size,
        rejected_rows: rejected,
        duplicate_rows: duplicates,
        warning_rows: warned.size,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);
    if (done.error) throw new Error(done.error.message);
    console.log(
      `${filename}: ${records.size} unique valid, ${duplicates} merged duplicates, ${rejected} rejected, ${warned.size} rows with warnings.`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    const { error: recordingError } = await db
      .from("import_runs")
      .update({
        status: "failed",
        error: message.slice(0, 1000),
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);
    if (recordingError)
      console.error(
        `Could not record failure for ${filename}: ${recordingError.message}`,
      );
    throw error;
  }
}
for (const brand of brands.filter(
  (brand) => !selectedBrand || brand.slug === selectedBrand,
)) {
  const empty = new Map<string, Reference>();
  await importFile(
    brand,
    `${brand.slug}-contacts.csv`,
    "contacts",
    empty,
    empty,
  );
  if (brand.slug === "kilele")
    await importFile(
      brand,
      "kilele-contacts-delta-2026-09-01.csv",
      "contacts",
      empty,
      empty,
    );
  await importFile(
    brand,
    `${brand.slug}-campaigns.csv`,
    "campaigns",
    empty,
    empty,
  );
  const [contacts, campaigns] = await Promise.all([
    references("contacts", brand.id),
    references("campaigns", brand.id),
  ]);
  await importFile(
    brand,
    `${brand.slug}-events.csv`,
    "events",
    contacts,
    campaigns,
  );
  if (brand.slug === "kilele")
    await importFile(
      brand,
      "kilele-send-log.csv",
      "send_log",
      contacts,
      campaigns,
    );
}
