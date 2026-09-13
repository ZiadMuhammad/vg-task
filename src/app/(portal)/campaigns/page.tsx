import { z } from "zod";
import Link from "next/link";
import { requireMembership } from "@/lib/auth";
import { PageHeading } from "@/components/page-heading";
import { CampaignTable } from "@/components/campaign-table";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { campaignSchema } from "@/lib/campaigns/metrics";

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; channel?: string; page?: string }>;
}) {
  const { supabase } = await requireMembership();
  const parsed = z
    .object({
      q: z.string().max(100).default(""),
      channel: z.enum(["all", "email", "sms"]).default("all"),
      page: z.coerce.number().int().min(1).max(10000).default(1),
    })
    .safeParse(await searchParams);
  if (!parsed.success)
    return (
      <p role="alert">
        Invalid campaign filters.{" "}
        <Link href="/campaigns" className="underline">
          Reset filters
        </Link>
      </p>
    );
  const { q, channel, page } = parsed.data;
  let query = supabase
    .from("campaign_metrics")
    .select("*", { count: "exact" })
    .order("sent_at", { ascending: false })
    .order("id")
    .range((page - 1) * 20, page * 20 - 1);
  if (q) query = query.ilike("name", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
  if (channel !== "all") query = query.eq("channel", channel);
  const { data, error, count } = await query;
  if (error || count === null) throw new Error("Campaigns unavailable");
  const campaigns = campaignSchema.array().parse(data);
  return (
    <>
      <PageHeading
        eyebrow="Performance"
        title="Your campaigns"
        description="Explore campaign history, understand the results, and plan your next send."
      />
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <form className="flex flex-wrap gap-3 border-b border-slate-200 p-5">
          <div className="min-w-48 flex-1">
            <label htmlFor="q" className="sr-only">
              Search campaigns
            </label>
            <Input
              id="q"
              name="q"
              defaultValue={q}
              maxLength={100}
              placeholder="Search campaign names"
            />
          </div>
          <label htmlFor="channel" className="sr-only">
            Channel
          </label>
          <select
            id="channel"
            name="channel"
            defaultValue={channel}
            className="rounded-lg border border-slate-300 bg-white p-2.5 text-sm"
          >
            <option value="all">All channels</option>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
          </select>
          <Button type="submit" variant="secondary">
            Apply filters
          </Button>
        </form>
        {campaigns.length ? (
          <CampaignTable campaigns={campaigns} />
        ) : (
          <div className="p-16 text-center text-sm text-slate-500">
            No campaigns match these filters.
          </div>
        )}
        <Pagination
          page={page}
          total={count}
          pageSize={20}
          pathname="/campaigns"
          filters={{ q, channel }}
        />
      </section>
      <p className="mt-5 text-xs leading-6 text-slate-500">
        Delivery rate uses historical reported delivered ÷ reported sent.
        Observed opens count distinct customer IDs from valid attributed raw
        events. These sources have different coverage and are not added
        together. All dates are UTC.
      </p>
    </>
  );
}
