# Campaign portal delivery plan

Supabase project: `ebdtyruhetdtqidukyyy`. Repository: `ZiadMuhammad/vg-task`.

## Milestones

1. Foundation: Next.js, styling, tooling, CI, instructions, repeatable schema workflow.
2. Authentication and isolation: six memberships, password login, database policies, direct access tests.
3. Imports and contacts: deterministic source adapters, quarantine reports, repeat-import tests, paginated contacts.
4. Campaigns and dashboard: transparent metric definitions, SQL aggregation, known-answer tests.
5. Sending and synchronization: frozen approval, durable queue, idempotency, event reconciliation and recovery tests.
6. Sharing and release: scoped password-protected reports, browser verification, deployment, submission guide, Google OAuth.

## Acceptance criteria

- Three brands, one owner and analyst each. Unapproved identities have no data access.
- Every exposed table uses RLS; views and RPCs preserve tenant boundaries.
- Owners can authorize sending/publishing; analysts cannot write or escalate membership.
- Imports expose rejected rows and reasons. Repeating any export is safe.
- Full data remains usable with server pagination, indexed filters and aggregate queries.
- Metric definitions explain source coverage, deduplication, denominators and timezone.
- Confirmation authorizes the exact saved audience. Concurrent confirmation creates one send.
- Provider failure never silently changes or duplicates the approved operation.
- Events are validated, deduplicated and reconciled independently of browser activity.
- Historical approvals remain unchanged when contacts or consent change.
- Removing RLS makes an isolation regression test fail.
- A share password exposes only that campaign's safe aggregate report.
- Loading, empty and failure states are explicit; mobile flows work.
- Public source, meaningful history, schema, README, six credentials and <=300-word review note are ready for submission.

## Decisions

- One Supabase project holds all brands. Supabase Auth users map to immutable database memberships.
- Source file identity determines brand. A conflicting brand field is rejected, never used to route a row.
- Contact identity is `(brand_id, external_id)`. Contact destinations are deduplicated per channel for sending.
- Unknown/invalid consent is never interpreted as permission. Imported suppression and adverse events remain conservative.
- Campaign audience is currently eligible contacts matching channel and optional target country. This assumption is shown in the app.
- Daily signup charts use UTC and the actual rolling last 30 calendar days, including today.
- Imported reported campaign totals remain separate from observed raw engagement. Raw events are not assumed to prove historical delivery totals.
- Events with missing customer references are rejected. Missing campaign references or inconsistent channels are retained with attribution warnings and excluded from campaign metrics; known adverse customer events still suppress sending.
- September delta supersedes baseline contact attributes, but cannot erase an adverse engagement event.
- A campaign can have one live approved dispatch in this assessment; duplicate confirmations return that operation. Historical imported sends are preserved separately.
- Provider documentation is a starting contract; the brief's messy/out-of-order reports govern tests.
- Queue records contain IDs; private payloads and retry identifiers are durable database records.
- Shared reports expose aggregate results only, with server verification, hashed passwords, revocation and attempt limits.

## Deferred user setup

Google OAuth account mapping and provider configuration are deliberately last. Do not mark this requirement complete until a real Google login is verified.

## Verified progress

- Milestone 1: lint, type checking and production build passed; foundation pushed to the requested repository.
- Milestone 2: six password users passed direct Supabase REST checks; transactional SQL checks passed on the dedicated hosted project. Disabling brand RLS made the same isolation assertion fail, and rollback restored the policy. Lint, type checking and production build passed. Local Docker was unavailable because the Mac ran out of disk space; CI runs the local database suite. Supabase advisors found no schema security findings; leaked-password protection is disabled in project Auth settings. Google remains deferred.

- Milestone 3: all 11 supplied files imported. Counts are Kilele 82,509 customers / 44 campaigns / 303,588 unique events; Karoo 12,406 / 19 / 69,100; Marrakech 918 / 6 / 940. Full archive replay preserved all counts and customer-data digests. Direct REST checks passed for all six users, including tables, contactability view and search RPC. Import regression SQL verified delta precedence, replay identity, cross-brand foreign keys, and persistent opt-outs. Customer/import pages passed desktop and 390-pixel browser checks without document overflow or browser errors.

- Milestone 4: dashboard, campaign list/detail, UTC signup chart and explicit metric definitions are implemented. Known-answer SQL tests verify deleted/unknown signup exclusions, 30-day coverage, distinct engagement and unchanged reported totals. Production build and browser checks passed. Query plans were reviewed against the full Kilele dataset, with a covering index for unattributed-event counts and customer pagination that avoids materializing the full result.

- Milestone 5: frozen approval, paginated audience, owner confirmation/recovery, durable PGMQ batches, Edge worker, Cron polling, event reconciliation and live dashboard results are implemented. Transactional safety tests and six-account REST denial checks cover the new surface. The live Marrakech dispatch preserved one approval across two simultaneous sessions; all 263 submissions were accepted in three batches. Worker authorization and scheduled HTTP invocations were verified. Provider cursor anomalies and unknown-recipient events are visible rather than silently counted.
