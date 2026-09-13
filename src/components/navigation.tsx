"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartNoAxesCombined, Users, Send, FileInput } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Overview", icon: ChartNoAxesCombined },
  { href: "/contacts", label: "Customers", icon: Users },
  { href: "/campaigns", label: "Campaigns", icon: Send },
  { href: "/imports", label: "Import history", icon: FileInput },
];

export function Navigation() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main navigation"
      className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-1"
    >
      {items.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname.startsWith(href) ? "page" : undefined}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white sm:gap-3",
            pathname.startsWith(href) && "bg-white/10 text-white",
          )}
        >
          <Icon className="size-[18px]" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
