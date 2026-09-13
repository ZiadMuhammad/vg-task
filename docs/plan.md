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
- Missing references and inconsistent event channels are quarantined with reasons.
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
