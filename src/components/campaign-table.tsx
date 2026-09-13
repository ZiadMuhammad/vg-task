import Link from "next/link";
import { ArrowUpRight, Mail, MessageSquare } from "lucide-react";
import { Badge } from "./ui/badge";
import { day, percentage, type Campaign } from "@/lib/campaigns/metrics";
import { number } from "@/lib/utils";
export function CampaignTable({ campaigns }: { campaigns: Campaign[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[750px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50/60 text-[11px] tracking-wide text-slate-500 uppercase">
          <tr>
            {[
              "Campaign",
              "Channel",
              "Reported sent",
              "Delivery rate",
              "Observed opens",
              "",
            ].map((label, index) => (
              <th key={index} className="px-5 py-4 font-medium">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {campaigns.map((campaign) => (
            <tr key={campaign.id} className="hover:bg-slate-50/60">
              <td className="px-5 py-4">
                <Link
                  href={`/campaigns/${campaign.id}`}
                  className="font-medium text-slate-800 hover:text-teal-700"
                >
                  {campaign.name}
                </Link>
                <p className="mt-1 text-xs text-slate-400">
                  {campaign.external_id} · {day(campaign.sent_at)}
                </p>
              </td>
              <td className="px-5 py-4">
                <Badge>
                  {campaign.channel === "email" ? (
                    <Mail className="mr-1 size-3" />
                  ) : (
                    <MessageSquare className="mr-1 size-3" />
                  )}
                  {campaign.channel === "email" ? "Email" : "SMS"}
                </Badge>
              </td>
              <td className="px-5 py-4 font-medium tabular-nums">
                {number.format(campaign.reported_sent)}
              </td>
              <td className="px-5 py-4 tabular-nums">
                {percentage(
                  campaign.reported_delivered,
                  campaign.reported_sent,
                )}
              </td>
              <td className="px-5 py-4 tabular-nums">
                {campaign.channel === "email"
                  ? number.format(campaign.observed_unique_opens)
                  : "Not applicable"}
              </td>
              <td className="px-5 py-4">
                <Link
                  href={`/campaigns/${campaign.id}`}
                  aria-label={`View ${campaign.name}`}
                  className="inline-flex rounded-lg p-2 text-slate-400 hover:bg-teal-50 hover:text-teal-700"
                >
                  <ArrowUpRight className="size-4" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
