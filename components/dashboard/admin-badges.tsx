"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// The admin's red dots: fetched on every page change and every minute. The
// page being viewed never shows its own dot (opening it is "seen").

type Badges = { orders?: boolean; approvals?: boolean; payouts?: boolean; emailLogs?: boolean };

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

/** Does this link get a dot? (never the page being viewed; approvals stay while any is pending) */
export function useNavBadge(href: string | undefined): boolean {
  const badges = useContext(BadgesContext);
  const pathname = usePathname();
  const key = href ? BADGE_OF[href] : undefined;
  if (!key || !badges[key]) return false;
  const here = pathname === href || pathname.startsWith(href + "/");
  return key === "approvals" ? !pathname.startsWith("/admin/approvals") : !here;
}

/** A dropdown gets a dot when one of its links has one. */
export function useAnyNavBadge(hrefs: (string | undefined)[]): boolean {
  const badges = useContext(BadgesContext);
  const pathname = usePathname();
  return hrefs.some((href) => {
    const key = href ? BADGE_OF[href] : undefined;
    return !!key && !!badges[key] && !(pathname === href || pathname.startsWith(href + "/"));
  });
}

export function BlinkDot({ className = "" }: { className?: string }) {
  return (
    <span className={`relative inline-flex h-2 w-2 shrink-0 ${className}`} aria-label="New">
      <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
    </span>
  );
}

/** The dot for one link, if it has one. */
export function NavDot({ href, className }: { href?: string; className?: string }) {
  return useNavBadge(href) ? <BlinkDot className={className} /> : null;
}

/** The dot for a dropdown, if one of its links has one. */
export function AnyNavDot({ hrefs, className }: { hrefs: (string | undefined)[]; className?: string }) {
  return useAnyNavBadge(hrefs) ? <BlinkDot className={className} /> : null;
}
