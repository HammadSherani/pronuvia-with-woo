"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { PronuviaLogoDark } from "./pronuvia-logo-dark";
import { useCart } from "@/lib/cart/cart-context";
import type { Role } from "@/generated/prisma/enums";
import { logout } from "@/actions/auth/logout";

function CartIcon({ href }: { href: string }) {
  const { totalItems } = useCart();
  return (
    <Link
      href={href}
      className="relative inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 transition-colors"
    >
      <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
      {totalItems > 0 && (
        <span className="absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1.5 bg-red-500 text-white text-xs font-black rounded-full flex items-center justify-center leading-none shadow-md ring-2 ring-white">
          {totalItems > 99 ? "99+" : totalItems}
        </span>
      )}
    </Link>
  );
}

type NavChild =
  | { label: string; href: string; action?: never }
  | { label: string; href?: never; action: () => void | Promise<void> };
type NavItem =
  | { label: string; href: string; children?: never }
  | { label: string; href?: never; children: NavChild[] };

function buildNav(role: Role): NavItem[] {
  if (role === "ADMIN") {
    return [
      {
        label: "Account",
        children: [
          { label: "Medical Representatives", href: "/admin/sales-reps" },
          { label: "Partnering Physicians", href: "/admin/physicians" },
          { label: "Pending Approvals", href: "/admin/approvals" },
        ],
      },
      {
        label: "Commission",
        children: [
          // { label: "Payout Requests",         href: "/admin/payout-requests" },
          { label: "Commission Payout",      href: "/admin/withdrawals" },
          { label: "Payout History",     href: "/admin/commission-history" },
          { label: "Commission Adjustment",  href: "/admin/wallet-adjustment" },
        ],
      },
      {
        label: "Product",
        children: [
          { label: "Products", href: "/admin/products" },
          { label: "Categories", href: "/admin/categories" },
          { label: "Sub-Categories", href: "/admin/sub-categories" },
        ],
      },
      // { label: "Coupons", href: "/admin/coupons" },
      {
        label: "Website",
        children: [
          { label: "Website Banners", href: "/admin/website-banners" },
          { label: "Blog Posts", href: "/admin/blogs" },
        ],
      },
      { label: "Email Logs", href: "/admin/email-logs" },
      {
        label: "My Account",
        children: [
          { label: "Account Details", href: "/admin/account" },
          { label: "Downloads", href: "/admin/downloads" },
          { label: "Logout", action: async () => { await logout(); } },
        ],
      },
    ];
  }

  if (role === "SALES_REP") {
    return [
      { label: "Website", href: "/" },

      // { label: "Terms and Conditions", href: "/Terms" },
      { label: "Contact Us", href: "/contact" },
      // { label: "Terms and conditions", href: "/terms" },
      {
        label: "My Account",
        children: [
          { label: "Account Details", href: "/sales/account" },
          { label: "Downloads", href: "/sales/downloads" },
          { label: "Terms and conditions", href: "/terms" },
          { label: "Logout", action: async () => { await logout(); } },
        ],
      },
    ];
  }

  // PHYSICIAN
  return [
    { label: "Website", href: "/" },
    { label: "Contact Us", href: "/contact" },
    {
      label: "My Account",
      children: [
        { label: "Account Details", href: "/physician/account" },
        { label: "Downloads", href: "/physician/downloads" },
        { label: "Terms and conditions", href: "/terms" },
         { label: "Logout", action: async () => { await logout(); } },
      ],
    },
  ];
}

function DropdownMenu({ item }: { item: NavItem & { children: NavChild[] } }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors cursor-pointer"
      >
        {item.label}

        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""
            }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full -left-20 mt-2 min-w-[180px] bg-white border border-gray-100 rounded-lg shadow-lg py-1 z-50">
          {item.children.map((child) =>
            child.action ? (
              <button
                key={child.label}
                type="button"
                onClick={async () => {
                  setOpen(false);
                  await child.action();
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-[#6b7280] hover:bg-gray-50 hover:text-[#374151] transition-colors"
              >
                {child.label}
              </button>
            ) : (
              <Link
                key={child.href}
                href={child.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-sm text-[#6b7280] hover:bg-gray-50 hover:text-[#374151] transition-colors"
              >
                {child.label}
              </Link>
            )
          )}
        </div>
      )}
    </div>
  );
}

export function MainHeader({ role }: { role: Role }) {
  const navItems = buildNav(role);

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 h-[70px] flex items-center justify-between">
        <PronuviaLogoDark />
        <nav className="flex items-center gap-6 flex-wrap">
          {navItems.map((item) =>
            item.children ? (
                <DropdownMenu
                  key={item.label}
                  item={item as NavItem & { children: NavChild[] }}
                />
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors whitespace-nowrap"
              >
                {item.label}
              </Link>
            )
          )}

          {role === "SALES_REP" && <CartIcon href="/sales/cart" />}
          {role === "PHYSICIAN" && <CartIcon href="/physician/cart" />}
        </nav>
      </div>
    </header>
  );
}
