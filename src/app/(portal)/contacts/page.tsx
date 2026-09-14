import { Mail, MessageSquare, Search, Users } from "lucide-react";
import { z } from "zod";
import { requireMembership } from "@/lib/auth";
import { PageHeading } from "@/components/page-heading";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { number } from "@/lib/utils";

const resultSchema = z.object({
  total: z.number(),
  page: z.number(),
  rows: z.array(
    z.object({
      id: z.string(),
      external_id: z.string(),
      full_name: z.string(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
      country: z.string().nullable(),
      city: z.string().nullable(),
      signup_at: z.string().nullable(),
      status: z.string(),
      consent_marketing: z.boolean(),
      contactable_email: z.boolean(),
      contactable_sms: z.boolean(),
    }),
  ),
});
const filtersSchema = z.object({
  q: z.string().max(100).default(""),
  country: z
    .string()
    .regex(/^([A-Z]{2})?$/)
    .default(""),
  eligibility: z.enum(["all", "email", "sms", "none"]).default("all"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase } = await requireMembership();
  const parsed = filtersSchema.safeParse(await searchParams);
  if (!parsed.success)
    return (
      <div role="alert">
        These customer filters are invalid.{" "}
        <a href="/contacts" className="underline">
          Reset filters
        </a>
      </div>
    );
  const filters = parsed.data;
  const { data, error } = await supabase.rpc(
    "search_contacts",
    {
      p_query: filters.q,
      p_country: filters.country,
      p_eligibility: filters.eligibility,
      p_page: filters.page,
    },
    { get: true },
  );
  if (error) throw new Error("Customer query failed");
  const result = resultSchema.parse(data);
  return (
    <>
      <PageHeading
        eyebrow="Audience"
        title="Your customers"
        description="A clear view of who you know, and who you can reach."
      >
        <Badge>{number.format(result.total)} matching customers</Badge>
      </PageHeading>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <form className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-5">
          <div className="min-w-52 flex-1">
            <label htmlFor="q" className="sr-only">
              Search customers
            </label>
            <div className="relative">
              <Search className="absolute top-3 left-3 size-4 text-slate-400" />
              <Input
                id="q"
                name="q"
                defaultValue={filters.q}
                maxLength={100}
                placeholder="Search name, email or customer ID"
                className="pl-9"
              />
            </div>
          </div>
          <div>
            <label htmlFor="country" className="sr-only">
              Country
            </label>
            <select
              id="country"
              name="country"
              defaultValue={filters.country}
              className="rounded-lg border border-slate-300 bg-white p-2.5 text-sm"
            >
              <option value="">All countries</option>
              {["KE", "ZA", "MA", "UG", "RW", "ET", "TZ", "SS"].map((code) => (
                <option key={code}>{code}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="eligibility" className="sr-only">
              Reachability
            </label>
            <select
              id="eligibility"
              name="eligibility"
              defaultValue={filters.eligibility}
              className="rounded-lg border border-slate-300 bg-white p-2.5 text-sm"
            >
              <option value="all">Any reachability</option>
              <option value="email">Email contactable</option>
              <option value="sms">SMS contactable</option>
              <option value="none">Not contactable</option>
            </select>
          </div>
          <Button type="submit" variant="secondary">
            Apply filters
          </Button>
        </form>
        {result.rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/60 text-[11px] tracking-wide text-slate-500 uppercase">
                <tr>
                  {[
                    "Customer",
                    "Location",
                    "Destinations",
                    "Reachability",
                    "Source status",
                  ].map((label) => (
                    <th key={label} className="px-5 py-4 font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.rows.map((contact) => (
                  <tr key={contact.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-800">
                        {contact.full_name}
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-slate-400">
                        {contact.external_id}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div>{contact.country ?? "Unknown"}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        {contact.city ?? "—"}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        <Mail className="size-3" />
                        {contact.email ?? "No valid email"}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <MessageSquare className="size-3" />
                        {contact.phone ?? "No valid phone"}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-1">
                        {contact.contactable_email && (
                          <Badge tone="positive">Email</Badge>
                        )}
                        {contact.contactable_sms && (
                          <Badge tone="positive">SMS</Badge>
                        )}
                        {!contact.contactable_email &&
                          !contact.contactable_sms && (
                            <Badge>Not contactable</Badge>
                          )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge
                        tone={
                          contact.status === "active" ? "neutral" : "warning"
                        }
                      >
                        {contact.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-20 text-center">
            <Users className="mx-auto mb-4 size-8 text-slate-300" />
            <h2 className="font-semibold">No customers match these filters</h2>
            <p className="mt-2 text-sm text-slate-500">
              Try a different search or reset your filters.
            </p>
          </div>
        )}
        <Pagination
          page={filters.page}
          total={result.total}
          pathname="/contacts"
          filters={{
            q: filters.q,
            country: filters.country,
            eligibility: filters.eligibility,
          }}
        />
      </section>
      <p className="mt-5 text-xs leading-6 text-slate-500">
        One customer per external ID within this brand. Contactable means
        active, explicit marketing consent, a valid destination, no deletion or
        active suppression, and no applicable bounce or opt-out. Unsubscribes
        and complaints block both channels. Different customer IDs can share a
        destination; sends deduplicate those destinations.
      </p>
    </>
  );
}
