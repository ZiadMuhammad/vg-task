# Velocity campaign portal

A private campaign workspace for Kilele Rides, Karoo Coaches, and Marrakech Express. Built for the Velocity Growth engineering assessment.

[Open the live portal](https://vg-task.vercel.app). The six password accounts are supplied privately. Google OAuth is the remaining setup step; its integration is implemented but disabled until provider configuration and a real login are verified.

## Stack

Next.js App Router, React, strict TypeScript, Tailwind CSS, shared Radix-based UI primitives, Supabase Auth/Postgres/RLS, Queues, scheduled Edge Functions, Zod, and Recharts. Vitest covers business rules; SQL and concurrent-connection tests run against real Supabase in CI. Browser flows were verified with Codex browser automation on desktop and at 390-pixel width.

## Development

Use Node.js 24 and pnpm. Install with `pnpm install --frozen-lockfile`. Copy `.env.example` to `.env.local`, configure the project, and run `pnpm dev`.

Never put a provider or service-role key in `NEXT_PUBLIC_` variables. Input data and account credentials belong in ignored `.data/` and `.local/` directories.

## Checks

- `pnpm lint`: static lint checks
- `pnpm typecheck`: strict TypeScript
- `pnpm test`: business-rule tests
- `pnpm build`: production compilation
- `pnpm test:access`: six-account tests against the configured project's real REST API
- `pnpm test:db`: transactional SQL, permission mutation tests, and concurrent confirmation against local Supabase
- `pnpm format:check`: consistent source formatting

## Project decisions

See the [delivery plan](docs/plan.md) for milestone evidence and explicit business assumptions, and the [walkthrough](docs/walkthrough.md) for the demo route and code entry points.

AI assistance: OpenAI Codex was used for planning, implementation, testing, review, and documentation. The implementation's guarantees are exercised by executable tests.

## Authentication and database checks

Identity is resolved from `public.memberships`, never user-editable metadata. Each user has one brand and one role. Browser and SSR queries use the anon key plus the signed-in user's session; table grants and RLS enforce access even outside the app. Public clients cannot update memberships.

- `pnpm accounts:provision` creates the six assessment accounts using server-only environment values. Passwords are saved only to ignored `.local/test-accounts.json`.
- `pnpm test:access` signs in as all six accounts and checks the actual Supabase REST API.
- `pnpm test:db` runs transactional SQL against local Supabase, then disables RLS inside a rolled-back transaction and proves the same test catches the breach. CI runs this on a fresh migrated database.
- `schema.sql` contains the ordered migration history. Apply migrations in `supabase/migrations` when provisioning another project.

## Importing the supplied exports

Extract the provided archive into ignored `.data/`, then run `pnpm data:import`. The importer trusts its fixed filename-to-brand mapping and rejects rows whose brand field disagrees. It supports the CP1252 Karoo export, semicolon-delimited Marrakech exports, and the September Kilele delta. Run `pnpm data:import -- --force` to deliberately replay completed files; normal reruns skip completed file hashes. `--brand=kilele` selects one brand.

Each file is journaled in `import_runs`. `import_issues` records line numbers, original values, and explanations. Embedded NUL characters are displayed as escaped text in rejected records. A failed batch leaves a visible failed run, and rerunning safely resumes by upserting stable identities. Imports are an administrative CLI operation; the portal lets both assigned roles inspect their own reports.

- Customer identity is the brand plus external ID. Duplicate destinations do not merge distinct customers.
- Within one export, later duplicate attributes win, while restrictive consent, status, deletion and suppression survive. Delta attributes supersede baseline attributes regardless of replay order.
- Invalid destinations become null with warnings; unknown consent means no permission. Invalid suppression dates reject the row. Date-only signup values use midnight UTC, while invalid signup values remain unknown.
- Engagement opt-outs survive all imports. Unsubscribe/complaint blocks both channels; bounce blocks the event's channel. An unattributed adverse event still protects its known customer.
- Historical campaign counts retain their source meaning. Reported opens may repeat and are not assumed to be unique recipients. Spend is stored in integer minor units; the source does not specify a currency.

The source archive and generated account credentials are intentionally excluded from Git.

## Metric definitions

| Metric                   | Definition                                                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Total customers          | Unique brand/customer IDs excluding records with `deleted_at`. The customer list retains those deleted records for inspection.                                                  |
| Contactable customers    | Current active customers with explicit consent and at least one valid, unsuppressed email/SMS destination. A customer eligible for both channels counts once.                   |
| Daily signups            | Current non-deleted customer records, grouped by their signup date in UTC, across the last 30 calendar days including today. Missing dates are excluded and counted separately. |
| Historical delivery rate | Source-reported delivered divided by source-reported sent. A zero denominator displays a dash; inconsistent percentages are not clamped.                                        |
| Observed engagement      | Distinct customer IDs per campaign and event type, only for valid campaign/channel attribution. Repeated opens from one customer count once.                                    |
| Spend                    | Source amount in integer minor units, displayed without an assumed currency.                                                                                                    |

Reported counts and raw-event counts have different coverage and are never added together. SMS opens are not presented as email-open metrics. The dashboard marks incomplete imports explicitly. Database aggregation and server pagination keep full customer/event datasets out of the browser.

## Reliable sends and delivery updates

Owners review a saved, paginated audience before confirmation. The database freezes campaign context, customer IDs, names, destinations, count and hash. Previews expire after 15 minutes. Destinations are deduplicated per channel; an address shared with a non-contactable record is excluded. New customers do not change an existing preview. Consent/destination changes before approval require a fresh review.

Confirmation locks the campaign and enqueues one approved dispatch, even across two sessions. Each batch contains up to 100 saved recipients. `campaign_approvals` and `approved_recipients` preserve approval history; `provider_batches` records submission progress. An interrupted request retains its private payload and idempotency key. Explicit provider rejections, withheld destinations, queued/unknown outcomes and accepted submissions are separate counts. Withdrawing consent after approval never rewrites the approved total. If consent changes after an uncertain request, automatic retries pause for reconciliation.

`campaign-worker` is a Supabase Edge Function protected by `WORKER_SECRET`. It reads the durable PGMQ queue with leases, backs off on failures, and polls delivery streams independently of browsers. `provider_events` deduplicates events; separate monotonic event flags prevent a late delivery from clearing a bounce or unsubscribe. Valid adverse events suppress the original customer and matching destinations within the same brand. Unknown recipients and malformed reports are recorded in `provider_event_issues`. Public clients cannot invoke worker RPCs or read private request payloads.

The observed provider uses smaller event pages than advertised and can report an empty, non-advancing cursor while claiming more results. This is recorded as a synchronization error and retried. Scans restart at least every five minutes, including stalled scans, so late/backfilled events are revisited. Provider event types are counted as unique saved recipients; types can overlap and opens are not assumed to prove delivery.

Deploy the function with `pnpm supabase functions deploy campaign-worker --project-ref <ref> --no-verify-jwt --use-api --import-map supabase/functions/campaign-worker/deno.json`. Gateway JWT verification is disabled because the function verifies its own worker secret. Install `VG_PROVIDER_API_KEY` and `WORKER_SECRET` using Supabase secrets. Add the project URL and the same worker secret to Vault as `vg_project_url` and `vg_worker_secret`, then run `scripts/schedule-worker.sql` to schedule the worker every minute. Inspect Cron job runs and `net._http_response` for scheduler failures; each batch shows its last synchronization/error in the portal. Temporary database interruptions leave durable work available for the next run.

Validation includes transactional database tests for approval count, destination deduplication, immutable history, duplicate confirmation, stale leases, identical retry requests, post-approval withholding, duplicate/out-of-order events and unknown-recipient quarantine. A live Marrakech send was confirmed concurrently by two independent owner sessions and produced one 263-recipient approval with three batches. The real provider accepted all 263; subsequent delivery, bounce, open and unsubscribe events were reconciled. CI runs local Supabase tests without requiring Docker on the development Mac.

A second live Marrakech SMS dispatch approved and submitted 262 destinations in three batches. Replaying an email batch with its stored payload and idempotency key returned the original provider batch. SMS open observations are not presented as meaningful open metrics.

Page reads tolerate temporary Supabase gateway failures. GET/HEAD requests retry HTTP 502/504 at most twice with short delays, supplementing the SDK's existing network/503/520 policy. An explicit abort signal and `no-store` ensure each attempt reaches Supabase instead of reusing Next.js's failed render-time response. Read-only RPCs use GET; mutations, including send confirmation and report-password verification, remain POST and are never replayed by this wrapper. Failed reads still show an error after retries are exhausted. The error boundary's “Try again” refetches the route, including failed membership reads in the portal layout. Logs retain the method, endpoint path and HTTP status without credentials or customer filters.

Recovery was checked in a local production build by injecting three consecutive 504 responses into recipient and membership reads, then restoring access and using “Try again.” A single injected timeout also recovered during a status refresh without showing the error page. These checks read the existing Kilele approval and never submitted another campaign. Regression tests exercise the installed Supabase client, cloned response bodies, preserved authorization, bounded retries, cancellation, and non-replayed confirmation requests.

## Password-protected reports

Owners publish one report per campaign with an unguessable UUID and a password of at least 12 characters (at most 64 UTF-8 bytes). PostgreSQL stores only a bcrypt hash in a private schema. A server action verifies the password and issues an HMAC-signed, HttpOnly, route-scoped session lasting one hour. Rotation and revocation increment the report version, immediately invalidating old sessions. Verification attempts have 15-minute limits per IP, report, and IP/report pair; IPs are HMAC-hashed before storage. Deploy behind a trusted proxy that overwrites `x-forwarded-for`, as Vercel does.

The shared route sits outside the portal layout and receives a strict aggregate-only DTO. It exposes no customer fields, account navigation, provider payloads, or other campaigns. `read_shared_report` and `verify_report_password` accept only the service role; anonymous and signed-in portal clients cannot execute them directly. Public/private function grants are explicitly restricted, and global default privileges close newly created functions until granted. Regression tests inspect EXECUTE itself and prove that granting the report reader to portal users makes the test fail.

## Deployed database and keys

Project URL: `https://ebdtyruhetdtqidukyyy.supabase.co`. The anon key and six account credentials are in the private submission handoff.

| Surface                 | Names                                                                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Identity                | `brands`, `memberships`                                                                                                                                                                                      |
| Imports and source data | `contacts`, `campaigns`, `import_runs`, `import_issues`, `imported_events`, `historical_sends`                                                                                                               |
| Live dispatch           | `campaign_approvals`, `approved_recipients`, `provider_batches`, `provider_events`, `provider_event_issues`                                                                                                  |
| Reports                 | `shared_reports`; private `report_credentials` and `report_attempts`                                                                                                                                         |
| Read views              | `contactability`, `campaign_metrics`, `dispatch_metrics`                                                                                                                                                     |
| Portal RPCs             | `search_contacts`, `dashboard_summary`, `prepare_campaign`, `confirm_campaign`, `retry_campaign`, `publish_report`, `revoke_report`                                                                          |
| Service RPCs            | `ingest_contacts`, `reconcile_import_page`, `claim_dispatch`, `finish_dispatch`, `fail_dispatch`, `claim_event_poll`, `finish_event_poll`, `fail_event_poll`, `verify_report_password`, `read_shared_report` |
| Background runtime      | Edge Function `campaign-worker`, Cron job `vg-campaign-worker`, PGMQ queue `campaign_dispatch`, private `batch_work`                                                                                         |

Browser and portal server rendering use the anon key plus the user's JWT. The report server uses the service-role key only for its two narrow report RPCs. The Edge worker uses the service-role key for worker RPCs and the issued provider key for every provider request. The worker secret protects scheduler invocation; a separate server secret signs report sessions. Private tables and queue payloads are not exposed through the Data API.

Vercel hosts the web app. Set its production variables from `.env.example` and set `NEXT_PUBLIC_SITE_URL` to the live origin. `.vercelignore` excludes credentials, local data, and build artifacts from uploads; `.gitignore` independently excludes them from source control.

## Final Google setup

Create a Google web OAuth client with origin `https://vg-task.vercel.app` and redirect URI `https://ebdtyruhetdtqidukyyy.supabase.co/auth/v1/callback`. Configure that client in Supabase's Google provider using only basic identity scopes. Map the intended Google email to the existing Kilele owner UUID, preserving its password and membership. Add the live `/auth/callback` URL to Supabase's redirect allowlist, enable `GOOGLE_AUTH_ENABLED=true` in Vercel, and redeploy. Verify Google login and password login resolve to that same membership. Unknown Google identities must still have no brand access. Do not claim this step complete until the live check succeeds.
