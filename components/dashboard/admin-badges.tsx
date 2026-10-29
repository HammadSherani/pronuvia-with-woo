"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// The admin's red counts: how many new things since each tab was last opened,
// fetched on every page change and every minute. The page being viewed never
// shows its own count (opening it clears it).

type Badges = { orders?: number; approvals?: number; payouts?: number; emailLogs?: number };

const BADGE_OF: Record<string, keyof Badges> = {
  "/admin/orders":      "orders",
  "/admin/approvals":   "approvals",
  "/admin/withdrawals": "payouts",
  "/admin/email-logs":  "emailLogs",
};

const BadgesContext = createContext<Badges>({});

export function AdminBadgesProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const [badges, setBadges] = useState<Badges>({});

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = () => fetch("/api/admin/nav-badges", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((b: Badges) => { if (alive) setBadges(b); })
      .catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, [enabled, pathname]);

  return <BadgesContext.Provider value={badges}>{children}</BadgesContext.Provider>;
}

/** The count for one link (0 for the page being viewed). */
function useCount(href: string | undefined): number {
  const badges = useContext(BadgesContext);
  const pathname = usePathname();
  const key = href ? BADGE_OF[href] : undefined;
  if (!key || !href) return 0;
  if (pathname === href || pathname.startsWith(href + "/")) return 0;
  return badges[key] ?? 0;
}

export function CountBadge({ count, className = "" }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span className={`relative inline-flex shrink-0 ${className}`} aria-label={`${count} new`}>
      <span className="absolute inset-0 rounded-full bg-red-400 opacity-60 animate-ping" />
      <span className="relative inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
        {count > 99 ? "99+" : count}
      </span>
    </span>
  );
}

/** The count for one link, if it has one. */
export function NavDot({ href, className }: { href?: string; className?: string }) {
  return <CountBadge count={useCount(href)} className={className} />;
}

/** A dropdown shows the total of its links. */
export function AnyNavDot({ hrefs, className }: { hrefs: (string | undefined)[]; className?: string }) {
  const badges = useContext(BadgesContext);
  const pathname = usePathname();
  const total = hrefs.reduce((sum, href) => {
    const key = href ? BADGE_OF[href] : undefined;
    if (!key || !href || pathname === href || pathname.startsWith(href + "/")) return sum;
    return sum + (badges[key] ?? 0);
  }, 0);
  return <CountBadge count={total} className={className} />;
}
