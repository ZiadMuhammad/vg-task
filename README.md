# Velocity campaign portal

A private campaign workspace for Kilele Rides, Karoo Coaches, and Marrakech Express. Built for the Velocity Growth engineering assessment.

## Stack

Next.js App Router, React, strict TypeScript, Tailwind CSS, shadcn UI components, Supabase Auth/Postgres/RLS, Queues, scheduled Edge Functions, Zod, and Recharts. Tests use Vitest, Playwright, and a real local Supabase database.

## Development

Use Node.js 24 and pnpm. Install with `pnpm install --frozen-lockfile`. Copy `.env.example` to `.env.local`, configure the project, and run `pnpm dev`.

Never put a provider or service-role key in `NEXT_PUBLIC_` variables. Input data and account credentials belong in ignored `.data/` and `.local/` directories.

## Checks

- `pnpm lint`: static lint checks
- `pnpm typecheck`: strict TypeScript
- `pnpm test`: business-rule tests
- `pnpm build`: production compilation
- Database and browser test commands are added with their implementation milestones.

## Project decisions

See [delivery plan](docs/plan.md) for scope, acceptance criteria, and explicit business assumptions. The application is being delivered in six separately committed milestones.

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
