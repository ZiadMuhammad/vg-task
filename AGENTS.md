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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
