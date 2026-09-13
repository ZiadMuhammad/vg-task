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
