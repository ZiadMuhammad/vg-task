import { CheckCircle2, KeyRound } from "lucide-react";
import { requireMembership } from "@/lib/auth";
import { PageHeading } from "@/components/page-heading";
import { ConnectGoogle } from "./connect-google";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { user, brand, membership } = await requireMembership();
  const { error } = await searchParams;
  const google = user.identities?.find(
    (identity) => identity.provider === "google",
  );
  const googleEmail = google?.identity_data?.email;
  return (
    <>
      <PageHeading
        eyebrow="Your workspace"
        title="Account"
        description="Manage how you sign in to your assigned brand."
      />
      <div className="max-w-2xl space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold">Your access</h2>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Brand</dt>
              <dd className="mt-1 font-medium">{brand.name}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Role</dt>
              <dd className="mt-1 font-medium capitalize">{membership.role}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Password sign-in email</dt>
              <dd className="mt-1 font-medium break-all">{user.email}</dd>
            </div>
          </dl>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <KeyRound aria-hidden className="size-5 text-teal-700" />
            <h2 className="font-semibold">Google sign-in</h2>
          </div>
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-900"
            >
              Google wasn’t connected. You can try again below. If that Google
              account is already in use, contact your administrator.
            </p>
          )}
          {google ? (
            <div className="mt-5">
              <p className="flex items-center gap-2 text-sm font-medium text-teal-800">
                <CheckCircle2 aria-hidden className="size-4" />
                Google connected
              </p>
              {typeof googleEmail === "string" && (
                <p className="mt-2 text-sm break-all text-slate-600">
                  {googleEmail}
                </p>
              )}
              <p className="mt-4 text-sm leading-6 text-slate-500">
                Use Continue with Google on the sign-in page to return to this
                workspace. Your existing password also works.
              </p>
            </div>
          ) : process.env.GOOGLE_AUTH_ENABLED === "true" ? (
            <div className="mt-4 space-y-5">
              <p className="text-sm leading-6 text-slate-600">
                Connect a Google account you control to this {brand.name}{" "}
                {membership.role} account. Google and your current password will
                open the same workspace with the same access.
              </p>
              <ConnectGoogle />
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-slate-500">
              Google sign-in is currently unavailable. Continue using your
              assigned email and password.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
