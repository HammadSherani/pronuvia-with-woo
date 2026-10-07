"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/actions/auth/logout";
import type { Role } from "@/generated/prisma/enums";
import { useCart } from "@/lib/cart/cart-context";

type SubNavItem =
  | { label: string; href: string; action?: never; isCart?: boolean }
  | { label: string; href?: never; action: () => void; isCart?: never };

function buildSubNav(role: Role): SubNavItem[] {
  if (role === "ADMIN") {
    return [
      { label: "Dashboard",       href: "/admin/dashboard" },
      { label: "Orders",          href: "/admin/orders" },
      { label: "Promotional Banners",         href: "/admin/banners" },
      { label: "Coupons",         href: "/admin/coupons" },
      { label: "Shipping Rates",   href: "/admin/shipping-rates" },
      { label: "Reports",          href: "/admin/reports" },
      // { label: "Downloads",       href: "/admin/downloads" },
      // { label: "Account",         href: "/admin/account" },
      // { label: "Log out",         action: async () => { await logout(); } },
    ];
  }

  if (role === "SALES_REP") {
    return [
      { label: "Dashboard",            href: "/sales/dashboard" },
      { label: "Partnering Physicians", href: "/sales/physicians" },
      { label: "Shop",      href: "/sales/shop" },
      { label: "Orders",    href: "/sales/orders" },
      { label: "Commission",    href: "/sales/wallet" },
      { label: "Payout History", href: "/sales/withdrawals" },
    ];
  }

  // PHYSICIAN
  return [
    { label: "Dashboard",        href: "/physician/dashboard" },
    { label: "Shop",             href: "/physician/shop" },
    { label: "Orders",           href: "/physician/orders" },
    { label: "Commission",       href: "/physician/wallet" },
    { label: "Payout History",   href: "/physician/withdrawals" },
  ];
}

export function SubHeader({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = buildSubNav(role);
  const { totalItems } = useCart();

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-[70px] z-30 overflow-x-auto">
      <div className="max-w-7xl mx-auto px-6 h-11 flex items-center gap-8 min-w-max mx-auto">
        {items.map((item) => {
          if (item.action) {
            return (
              <button
                key={item.label}
                onClick={item.action}
                className="text-[13px] text-gray-500 hover:text-gray-900 font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {item.label}
              </button>
            );
          }
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? "text-gray-900 border-b-2 border-gray-900 pb-0.5"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {item.label}
              {item.isCart && totalItems > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-gray-900 text-white rounded-full leading-none">
                  {totalItems > 9 ? "9+" : totalItems}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
