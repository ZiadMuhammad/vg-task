# Google sign-in and account linking

The Google identity is another way to authenticate the same portal user. The user's existing membership remains the source of their brand and role. This supports all six assigned accounts without adding a role picker or granting portal access to every Google user.

## Configuration

The hosted Google provider and manual linking settings were installed on 14 September 2026. Application support is implemented; real Google authorization and subsequent sign-in still require user verification. Do not describe all six Google logins as verified until each has been exercised.

Google Cloud uses a Web application OAuth client with:

- JavaScript origin: `https://vg-task.vercel.app`
- Google-to-Supabase redirect: `https://ebdtyruhetdtqidukyyy.supabase.co/auth/v1/callback`
- Basic identity scopes only: `openid`, `userinfo.email`, and `userinfo.profile`

The client ID and secret belong in Supabase's Google provider settings. The secret is not an application environment variable and is never committed or shipped to Vercel/browser code. Keep nonce checking enabled.

Supabase's Auth configuration must enable the Google provider and manual identity linking. Its redirect allowlist contains these exact application URLs:

- `https://vg-task.vercel.app/auth/callback`
- `https://vg-task.vercel.app/auth/link/callback`

The web application uses `NEXT_PUBLIC_SITE_URL=https://vg-task.vercel.app` and `GOOGLE_AUTH_ENABLED=true`. Local development needs matching callback origins and redirect allowlist entries for the actual port; the Google-to-Supabase callback remains the hosted Supabase URL when using the hosted database.

Google documents publishing, brand verification, and sensitive-scope verification as separate controls. The current app requests only identity data. Check its actual consent screen and intended audience before submission; do not assume that basic sign-in proves branding verification.

## First connection

1. Sign in with the assigned portal email and password.
2. Open **Account** and check the displayed brand, role, and password email.
3. Click **Connect Google** and choose the Google account that should access this membership.
4. Complete Google authorization personally.
5. On return, verify **Google connected** and the intended Google email.
6. Sign out, choose **Continue with Google**, and verify the same brand and role.
7. Sign out again and verify the original password credentials still work.

Connecting a different email uses Supabase's documented `linkIdentity()` flow, currently described as beta. It requires an authenticated session and the project-level manual-linking setting. The application also checks membership before beginning it. The Google login identifier is not automatically substituted for the original password email.

If someone tries Google sign-in before connecting it to their assigned account, Supabase may create an unassigned Auth user. The portal denies it. If that subsequently prevents linking because the identity is already in use, an administrator must inspect the existing Auth identity and memberships before resolving the conflict. The app does not automatically delete, merge, or reassign accounts on that error.

## Request flow and security

- `/login` invokes `signInWithOAuth()` with a fixed callback and account selection prompt.
- `/account` invokes `linkIdentity()` through the signed-in user's Supabase client. The server action accepts no account ID, brand, role, or email to determine its target.
- Supabase and Google handle OAuth state and the PKCE exchange. The application's SSR client stores its verifier/session in cookies.
- `/auth/callback` returns to `/dashboard`; `/auth/link/callback` returns to `/account`.
- Both callbacks exchange the code and query the existing membership using the verified Auth user ID. They expose no caller-controlled external redirect.
- An identity without membership is signed out locally and returned to the access-denied login message. A membership query error is reported separately as a service failure.
- Cancelled linking returns to Account with an error and preserves the existing password session. Provider descriptions and codes are not reflected into the displayed error.
- Account data uses the existing membership check and session-refresh proxy. RLS and owner-only database operations continue to apply regardless of sign-in method.
- No service-role client, editable Google/user metadata, or email string is used to create authorization in this flow.

The public provider configuration itself allows authentication attempts from Google users. Database memberships and permissions enforce portal access. Linking changes how an existing account can be accessed, so only connect a Google identity intended to control that account.

## Verification

`tests/unit/google-auth.test.ts` adds 14 tests covering membership lookup, denial of an unassigned identity claiming an owner role in metadata, service failure handling, missing/cancelled/expired callback behavior, fixed redirect destinations, authenticated linking, the feature flag, existing Google connections, and safe provider errors. These use controlled dependencies; they do not simulate Google's real consent or prove a live linked identity.

Local verification passed lint, type checking, all 47 unit tests, the production build, and the six-account hosted REST access suite. The Account page was inspected at desktop and 390-pixel widths. A cancelled-link callback returned to the same signed-in account with an explicit error.

Required live sign-off:

- [ ] Kilele owner: correct Google identity, same membership, password still works.
- [ ] Kilele analyst: correct identity and read-only access.
- [ ] Karoo owner: correct identity and brand access.
- [ ] Karoo analyst: correct identity and read-only access.
- [ ] Marrakech owner: correct identity and brand access.
- [ ] Marrakech analyst: correct identity and read-only access.
- [ ] An unrelated Google user cannot enter any portal or read tenant data.
- [ ] Actual Google cancellation and return to the app work on the deployed origin.

References: [Supabase Google setup](https://supabase.com/docs/guides/auth/social-login/auth-google), [identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking), [Google OAuth app states](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview).
