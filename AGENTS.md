# Engineering agreement

Build only the client campaign portal described in `docs/plan.md`.

- Use Next.js App Router, strict TypeScript, Tailwind, Supabase, and pnpm.
- Keep interface code, validated server operations, and database guarantees separate.
- Use database membership and RLS for brand isolation. Never trust a submitted brand or user metadata for authorization.
- Public clients never receive provider keys, service-role keys, passwords, or raw shared-report credentials.
- Store every database change in a migration; `schema.sql` is the concatenated migration history.
- Preserve immutable approvals and request payloads. Provider retries reuse the same idempotency key.
- Data problems must be visible. Never turn an unexpected error into a successful empty result or zero metric.
- Keep new dependencies purposeful, pin their versions, and commit the lockfile.
- Run `pnpm lint`, `pnpm typecheck`, and tests appropriate to the milestone. Run the production build before release.
- Test real database permissions and concurrency, not just UI visibility or mocks.
- Explain behavior and important tradeoffs. Comments explain why; names explain what.
- Commit each completed milestone separately. Use repository author ZiadMuhammad and remote ZiadMuhammad/vg-task.
- Keep credentials, input archives, test-account passwords, and local tooling in ignored files.
- Google OAuth configuration is the final user-assisted step, as requested.
