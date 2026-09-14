# Demo and code walkthrough

Use the six credentials in the private handoff. The public repository deliberately contains no passwords or provider key.

## A ten-minute demo

1. Sign in as the Kilele owner. Explain the difference between total customers, contactable customers, and deduplicated send destinations. Expand the daily chart's counting rules. Search customers and inspect the import warnings; this uses the full large-brand dataset.
2. Sign out and use a Karoo analyst. The brand changes because of the database membership. Campaign details have no send or publish controls. Direct RPC calls also deny owner actions.
3. Use the Marrakech owner and open **Campagne 6 (MAR-0006)**. Its live email dispatch has a frozen approval of 263 recipients. Open the saved audience and batch records; accepted submissions and delivered messages are separate facts. The historical export remains separately labeled below.
4. Open **Campagne 1 (MAR-0001)** for the 262-recipient SMS example. SMS opens display as not applicable. Delivery failures and opt-outs reduce future contactability without rewriting either approval.
5. Open the shared Campagne 6 URL in a separate browser session. A wrong password reveals no campaign information. The correct password exposes aggregate results, with no customers or portal navigation. Rotation/revocation can be demonstrated with a different campaign so the supplied submission link keeps working.
6. Show a green GitHub Actions run and the database mutation test. Explain that removing RLS or granting a server report RPC to portal users makes the test fail.

## Explain the guarantees from the code

| Question                                                 | Start reading here                                                                        | What to explain                                                                                                                            |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Who can see this brand?                                  | `src/lib/auth.ts`; `supabase/migrations/20260913191906_auth_foundation.sql`               | Authenticated identity maps to database membership. RLS is enforced beneath the UI. User metadata is not trusted.                          |
| What if an export is loaded again?                       | `scripts/import-seed.ts`; `src/lib/imports/`; `20260913193010_imports_and_contacts.sql`   | File journal, stable brand/customer IDs, source priority, quarantine, and monotonic suppression.                                           |
| What exactly does the chart count?                       | `20260913195136_dashboard_metrics.sql`; `tests/integration/metrics.sql`                   | UTC day boundaries, deleted records, null dates, explicit denominators, and distinct raw engagement versus reported totals.                |
| What did the owner approve?                              | `20260913211619_reliable_dispatch.sql`: `prepare_campaign` and `confirm_campaign`         | Freeze audience and context, check count/hash/expiry, lock campaign, enqueue atomically. A second confirmation returns the same operation. |
| What if the provider accepted but our connection failed? | `supabase/functions/_shared/provider.ts`; `private.batch_work`                            | Persist the request body and idempotency key before the network call. Retry exactly that request. Unknown outcomes stay visible.           |
| How do delayed events change contactability?             | `finish_event_poll`; `tests/integration/dispatch.sql`                                     | Leased page/cursor updates, event deduplication, independent event flags, and conservative suppression across matching destinations.       |
| Why is the public report safe?                           | `src/app/share/`; `src/lib/reports/`; password-report and function-permission migrations  | Hashed password, bounded signed session, version invalidation, attempt limits, aggregate DTO, service-only RPCs.                           |
| What happens if a future edit breaks isolation?          | `tests/integration/isolation.sql`; `function-permissions.sql`; `scripts/test-database.ts` | Test direct permissions and deliberately mutate those permissions to prove the assertions detect the missing boundary.                     |

## Tradeoffs to own

- Imports run through an administrative CLI. Marketers inspect row-level problems in the portal; uploading new exports was outside the requested flow.
- Each campaign supports one approved live dispatch. Repeated confirmations are retries of that operation. A new campaign is a separate operation.
- Reported campaign totals and observed event totals have different coverage. Historical delivery rates depend on the source export; no exact raw-event delivery total is invented.
- Consent rules favor withholding an uncertain destination. Shared destinations linked to a non-contactable customer are excluded from sending.
- Cron runs every minute; provider scans repeat to collect delayed reports. This is eventual synchronization, not instant delivery. Errors and the oldest batch synchronization time stay visible.
- The provider sometimes emits unknown recipients and stalled cursors. Those issues are recorded for inspection, and do not become successful delivery counts.
- Google is configured. Demonstrate **Account → Connect Google** from an assigned password account, then sign out and return with **Continue with Google**. Verify the same brand/role and that password login still works. Track the six intended identities and the unrelated-account rejection in `docs/google-auth.md` before claiming the assessment is complete.

AI assistance was OpenAI Codex for planning, implementation, review, testing, and documentation. Read these entry points and run the demo yourself before the interview; be able to explain why each guarantee is in the database rather than relying on a button being hidden.
