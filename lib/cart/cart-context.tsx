"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";

export type CartItem = {
  cartId:       string;
  productId:    string;
  productTitle: string;
  productSlug:  string;
  productImage: string | null;
  variantSize:  string;
  variantSku:   string;
  unitPrice:    number;
  quantity:     number;
};

type CartContextValue = {
  items:      CartItem[];
  addItem:    (item: Omit<CartItem, "cartId">) => void;
  removeItem: (cartId: string) => void;
  updateQty:  (cartId: string, qty: number) => void;
  clearCart:  () => void;
  totalItems: number;
  totalPrice: number;
  // False until the cart has finished reading its persisted state from
  // localStorage — "Add to Cart" buttons should stay disabled until then,
  // since an add before this point can be silently clobbered by the load.
  isReady:    boolean;
};

const CartCtx = createContext<CartContextValue | null>(null);

export function CartProvider({ userId, cartKey, children }: { userId?: string; cartKey?: string; children: React.ReactNode }) {
  const storageKey = cartKey ?? `pronuvia_cart_${userId ?? "guest"}`;
  const [items,    setItems]    = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const didRead = useRef(false);

  // Re-read when userId changes (different user logged in)
  useEffect(() => {
    didRead.current = false;
  }, [userId]);

  // Read from localStorage once on mount / on userId change
  useEffect(() => {
    if (didRead.current) return;
    didRead.current = true;
    try {
      const raw = localStorage.getItem(storageKey);
      setItems(raw ? JSON.parse(raw) : []);
    } catch { setItems([]); }
    setHydrated(true);
  }, [storageKey]);

  // Persist on every change after hydration
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(storageKey, JSON.stringify(items)); } catch {}
  }, [items, hydrated, storageKey]);

  const addItem = useCallback((item: Omit<CartItem, "cartId">) => {
    setItems((prev) => {
      const existing = prev.find(
        (i) => i.productId === item.productId && i.variantSize === item.variantSize
      );
      if (existing) {
        return prev.map((i) =>
          i.cartId === existing.cartId
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        );
      }
      const cartId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      return [...prev, { ...item, cartId }];
    });
  }, []);

  const removeItem = useCallback((cartId: string) => {
    setItems((prev) => prev.filter((i) => i.cartId !== cartId));
  }, []);

  const updateQty = useCallback((cartId: string, qty: number) => {
    if (qty < 1) return;
    setItems((prev) => prev.map((i) => i.cartId === cartId ? { ...i, quantity: qty } : i));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    try { localStorage.removeItem(storageKey); } catch {}
  }, [storageKey]);

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  return (
    <CartCtx.Provider value={{ items, addItem, removeItem, updateQty, clearCart, totalItems, totalPrice, isReady: hydrated }}>
      {children}
    </CartCtx.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
