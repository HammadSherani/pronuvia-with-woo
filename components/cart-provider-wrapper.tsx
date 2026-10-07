"use client";

import { CartProvider } from "@/lib/cart/cart-context";

export function CartProviderWrapper({ userId, children }: { userId: string; children: React.ReactNode }) {
  return <CartProvider userId={userId}>{children}</CartProvider>;
}
