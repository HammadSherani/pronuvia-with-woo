"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useCart } from "@/lib/cart/cart-context";
import { formatCurrency } from "@/lib/utils/currency";

type VariantStatus = "in_stock" | "out_of_stock" | "discontinued" | "inactive";
type Variant  = { size?: string; salePrice?: number; stock?: number; sku?: string; status?: VariantStatus; isDefault?: boolean };

function variantStatus(v: Variant): VariantStatus { return v.status ?? "in_stock"; }
function isAvailable(v: Variant) { return variantStatus(v) === "in_stock"; }
function isVisible(v: Variant)   { return variantStatus(v) !== "inactive"; }
type Product  = { id: string; title: string; slug: string; image: string | null; salePrice: number; variants: unknown[]; category: { id: string; name: string } | null; status: string };
type Category = { id: string; name: string };

function ProductCard({ product, basePath }: { product: Product; basePath: string }) {
  const allVariants = product.variants as Variant[];
  const variants    = allVariants.filter(isVisible).sort((a, b) => parseFloat(b.size ?? "0") - parseFloat(a.size ?? "0"));
  const { addItem, items, updateQty, removeItem, isReady } = useCart();

  const defaultIdx        = variants.findIndex((v) => v.isDefault);
  const firstAvailableIdx = variants.findIndex(isAvailable);
  const initialIdx = defaultIdx >= 0 && isAvailable(variants[defaultIdx])
    ? defaultIdx
    : firstAvailableIdx >= 0 ? firstAvailableIdx : 0;
  const [selectedIdx, setSelectedIdx] = useState(initialIdx);
  const [pulse,       setPulse]       = useState(false);
  const [qty,         setQty]         = useState(1);

  const selected    = variants[selectedIdx] ?? variants[0] ?? null;
  const unitPrice   = selected?.salePrice ?? product.salePrice;
  const variantSize = selected?.size ?? "";
  const variantSku  = selected?.sku  ?? "";
  const selectedAvailable = selected ? isAvailable(selected) : true;

  const cartItem = items.find(
    (i) => i.productId === product.id && i.variantSize === variantSize
  );
  const inCart = !!cartItem;

  const prices     = variants.length > 0 ? variants.map((v) => v.salePrice ?? product.salePrice) : [product.salePrice];
  const minPrice   = Math.min(...prices);
  const maxPrice   = Math.max(...prices);
  const priceLabel = variants.length > 1 && minPrice !== maxPrice
    ? `${formatCurrency(maxPrice)} – ${formatCurrency(minPrice)}`
    : formatCurrency(unitPrice);

  function handleAddToCart() {
    if (!isReady) return;
    if (!selectedAvailable) {
      toast.error("This variant is out of stock.");
      return;
    }
    addItem({
      productId:    product.id,
      productTitle: product.title,
      productSlug:  product.slug,
      productImage: product.image,
      variantSize,
      variantSku,
      unitPrice,
      quantity: qty,
    });
    setQty(1);
    setPulse(true);
    toast.success("Added to cart!");
    setTimeout(() => setPulse(false), 2000);
  }

  function stepInCart(delta: number) {
    if (!cartItem) return;
    const next = cartItem.quantity + delta;
    if (next <= 0) removeItem(cartItem.cartId);
    else updateQty(cartItem.cartId, next);
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden group">

      {/* Image */}
      <div className="relative aspect-square bg-gray-50 overflow-hidden">
        <Link href={`${basePath}/${product.slug}`} className="block w-full h-full">
          {product.image ? (
            <img
              src={product.image}
              alt={product.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-16 h-16 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </Link>

        {variants.length > 1 && (
          <span className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-gray-500 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-gray-200 shadow-sm">
            {variants.length} sizes
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex-1 flex flex-col gap-2">
        {product.category && (
          <p className="text-[10px] tracking-[0.12em] uppercase text-[#3DBFA4] font-semibold">
            {product.category.name}
          </p>
        )}

        <Link href={`${basePath}/${product.slug}`}>
          <p className="text-sm font-semibold text-gray-900 leading-snug hover:text-[#3DBFA4] transition-colors line-clamp-2">
            {product.title}
          </p>
        </Link>

        {/* Size chips — a single-size product renders one static (non-interactive) badge
            instead of a clickable chip, but the size is always shown. */}
        {variants.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {variants.length === 1 ? (
              <span className="px-2.5 py-1 text-xs font-medium rounded-lg border bg-white text-gray-600 border-gray-200">
                {variants[0].size ?? "Option 1"}
              </span>
            ) : (
              variants.map((v, idx) => {
                const available = isAvailable(v);
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={!available}
                    onClick={() => { if (available) { setSelectedIdx(idx); setQty(1); } }}
                    title={!available ? (variantStatus(v) === "out_of_stock" ? "Out of Stock" : "Discontinued") : undefined}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${
                      !available
                        ? "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed line-through"
                        : selectedIdx === idx
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-900 hover:text-[#3DBFA4]"
                    }`}
                  >
                    {v.size ?? `Option ${idx + 1}`}
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Price + Qty + Cart */}
        <div className="mt-auto pt-2 border-t border-gray-50 space-y-2">
          <p className="text-sm font-bold text-gray-800">
            {variants.length > 1 ? formatCurrency(unitPrice) : priceLabel}
          </p>
          <div className="flex items-center gap-2">
            {/* Quantity stepper */}
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden shrink-0">
              <button
                type="button"
                disabled={!selectedAvailable}
                onClick={() => inCart ? stepInCart(-1) : setQty((q) => Math.max(1, q - 1))}
                className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 text-sm font-bold transition-colors disabled:opacity-30"
              >−</button>
              <span className="px-1.5 text-xs font-semibold text-gray-800 min-w-[22px] text-center">
                {inCart ? (cartItem?.quantity ?? 1) : qty}
              </span>
              <button
                type="button"
                disabled={!selectedAvailable}
                onClick={() => inCart ? stepInCart(1) : setQty((q) => q + 1)}
                className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 text-sm font-bold transition-colors disabled:opacity-30"
              >+</button>
            </div>

            {/* Add to Cart / In Cart */}
            <button
              type="button"
              onClick={!inCart ? handleAddToCart : undefined}
              disabled={!isReady || !selectedAvailable}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                !isReady || !selectedAvailable
                  ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                  : inCart || pulse
                    ? "bg-gray-900 text-white cursor-default"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-900 hover:text-white"
              }`}
            >
              {!isReady ? (
                <span className="w-3.5 h-3.5 shrink-0 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              )}
              {!isReady ? "Loading…" : !selectedAvailable ? "Out of Stock" : inCart ? "In Cart" : "Add to Cart"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ShopProducts({
  products,
  categories,
  basePath = "/sales/shop",
}: {
  products: Product[];
  categories: Category[];
  basePath?: string;
}) {
  const [search, setSearch] = useState("");
  const [catId,  setCatId]  = useState<string>("all");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return products.filter((p) => {
      const matchCat  = catId === "all" || p.category?.id === catId;
      const matchName = !q || p.title.toLowerCase().includes(q);
      return matchCat && matchName;
    });
  }, [products, search, catId]);

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-1 overflow-x-auto">
          {[{ id: "all", name: "All Products" }, ...categories].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCatId(cat.id)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors shrink-0 ${
                catId === cat.id
                  ? "text-gray-900 bg-gray-100 font-semibold"
                  : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="relative shrink-0">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/30 focus:border-gray-900 transition-colors w-52"
          />
        </div>
      </div>

      {(search || catId !== "all") && (
        <p className="text-xs text-gray-400 mb-4">
          {filtered.length} product{filtered.length !== 1 ? "s" : ""}
          {catId !== "all" && ` in ${categories.find((c) => c.id === catId)?.name ?? ""}`}
          {search && ` matching "${search}"`}
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-500">No products found</p>
          <p className="text-xs text-gray-400 mt-1">Try a different search or category</p>
          {(search || catId !== "all") && (
            <button
              onClick={() => { setSearch(""); setCatId("all"); }}
              className="mt-4 text-xs text-[#3DBFA4] hover:underline font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} basePath={basePath} />
          ))}
        </div>
      )}
    </div>
  );
}
