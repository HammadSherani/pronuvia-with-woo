"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { QuickOrderModal } from "@/components/sales/quick-order-modal";
import { useCart } from "@/lib/cart/cart-context";
import { formatCurrency } from "@/lib/utils/currency";

type VariantStatus = "in_stock" | "out_of_stock" | "discontinued" | "inactive";
type Variant = { size?: string; salePrice?: number; stock?: number; sku?: string; image?: string; status?: VariantStatus; isDefault?: boolean };

function defaultSelectableIdx(variants: Variant[]): number {
  const defaultIdx = variants.findIndex((v) => v.isDefault);
  if (defaultIdx >= 0 && isAvailable(variants[defaultIdx])) return defaultIdx;
  return variants.length === 1 && isAvailable(variants[0]) ? 0 : -1;
}

function variantStatus(v: Variant): VariantStatus { return v.status ?? "in_stock"; }
function isAvailable(v: Variant) { return variantStatus(v) === "in_stock"; }
function isVisible(v: Variant)   { const s = variantStatus(v); return s !== "inactive"; }
type RelatedProduct = {
  id: string; title: string; slug: string; image: string | null;
  salePrice: number; variants: unknown[];
  category: { name: string } | null;
};

type Props = {
  product: {
    id: string; title: string; slug: string; description: string | null;
    image: string | null; imageGallery: string[];
    salePrice: number; compareAtPrice: number | null;
    variants: unknown[]; tags: string[];
    category:    { name: string } | null;
    subCategory: { name: string } | null;
  };
  related: RelatedProduct[];
};

// ── Related product mini-card
function RelatedCard({ p, basePath }: { p: RelatedProduct; basePath: string }) {
  const allVariants = p.variants as Variant[];
  const variants    = allVariants.filter(isVisible).sort((a, b) => parseFloat(b.size ?? "0") - parseFloat(a.size ?? "0"));
  const [selIdx,  setSelIdx]  = useState(() => defaultSelectableIdx(variants));
  const [qty,     setQty]     = useState(1);
  const [modal,   setModal]   = useState(false);

  const sel = selIdx >= 0 ? variants[selIdx] : null;
  const prices = variants.length > 0 ? variants.map((v) => v.salePrice ?? p.salePrice) : [p.salePrice];
  const min = Math.min(...prices), max = Math.max(...prices);
  const displayPrice = sel?.salePrice ?? (min === max ? min : null);

  function handleBuy() {
    if (variants.length > 0 && selIdx < 0) { toast.error("Please select a size first."); return; }
    if (sel && !isAvailable(sel)) { toast.error("This variant is not available for purchase."); return; }
    setModal(true);
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden">
        <Link href={`${basePath}/${p.slug}`}>
          <div className="aspect-square bg-[#f8f9fa] flex items-center justify-center overflow-hidden">
            {p.image
              ? <img src={p.image} alt={p.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
              : <svg className="w-10 h-10 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            }
          </div>
        </Link>
        <div className="px-3 pt-3 pb-1 border-b border-gray-100">
          <p className="text-[9px] tracking-[0.15em] uppercase text-gray-400 mb-1.5">
            {variants.length > 0 ? "Size" : " "}
          </p>
          {variants.length > 0 ? (
            <select value={selIdx} onChange={(e) => setSelIdx(parseInt(e.target.value))}
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-gray-900 transition-colors text-gray-700">
              <option value={-1}>— Size —</option>
              {variants.map((v, i) => {
                const available = isAvailable(v);
                const suffix = !available ? ` (${variantStatus(v) === "out_of_stock" ? "Out of Stock" : "Discontinued"})` : "";
                return (
                  <option key={i} value={i} disabled={!available}>
                    {v.size}{v.salePrice !== undefined ? ` — ${formatCurrency(v.salePrice)}` : ""}{suffix}
                  </option>
                );
              })}
            </select>
          ) : <div className="h-7" />}
        </div>
        <div className="px-3 pt-2 flex-1">
          {p.category && <p className="text-[9px] tracking-[0.15em] uppercase text-gray-400 mb-0.5">{p.category.name}</p>}
          <Link href={`${basePath}/${p.slug}`}>
            <p className="text-sm font-bold text-gray-900 hover:text-[#3DBFA4] transition-colors leading-snug">{p.title}</p>
          </Link>
          <p className="text-sm font-bold text-[#1a6b58] mt-0.5">
            {displayPrice !== null ? formatCurrency(displayPrice) : `${formatCurrency(min)}${min !== max ? ` – ${formatCurrency(max)}` : ""}`}
          </p>
        </div>
        <div className="px-3 pt-2 flex items-center gap-2">
          <span className="text-[9px] tracking-[0.15em] uppercase text-gray-400">QTY</span>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-base leading-none">−</button>
            <span className="w-8 text-center text-xs font-semibold text-gray-800">{qty}</span>
            <button type="button" onClick={() => setQty((q) => q + 1)} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-base leading-none">+</button>
          </div>
        </div>
        <div className="px-3 py-3 flex gap-2">
          <Link href={`${basePath}/${p.slug}`}
            className="flex-1 flex items-center justify-center gap-1 py-2 border border-gray-200 text-xs font-semibold text-gray-700 rounded-xl hover:bg-gray-50 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
            Add to Cart
          </Link>
          <button type="button" onClick={handleBuy}
            className="flex-1 flex items-center justify-center gap-1 py-2 bg-gray-900 text-white text-xs font-semibold rounded-xl hover:bg-gray-700 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            Buy Now
          </button>
        </div>
      </div>
      {modal && (
        <QuickOrderModal
          product={{ id: p.id, title: p.title, salePrice: p.salePrice }}
          variantSize={sel?.size ?? ""}
          variantSku={sel?.sku ?? ""}
          unitPrice={sel?.salePrice ?? p.salePrice}
          qty={qty}
          onClose={() => setModal(false)}
        />
      )}
    </>
  );
}

// ── Main product detail client component
export function ProductDetailClient({ product, related, basePath = "/sales/shop" }: Props & { basePath?: string }) {
  const allVariants = product.variants as Variant[];
  const variants    = allVariants.filter(isVisible).sort((a, b) => parseFloat(b.size ?? "0") - parseFloat(a.size ?? "0"));

  const [activeImage, setActiveImage]   = useState(product.image ?? "");
  const [selectedIdx, setSelectedIdx]   = useState(() => defaultSelectableIdx(variants));
  const [qty,         setQty]           = useState(1);
  const [activeTab,   setActiveTab]     = useState<"info" | "reviews">("info");
  const [showModal,   setShowModal]     = useState(false);
  const [justAdded,   setJustAdded]     = useState(false);
  const { addItem, isReady } = useCart();

  const allImages = [product.image, ...product.imageGallery].filter(Boolean) as string[];
  const selectedVariant = selectedIdx >= 0 ? variants[selectedIdx] : null;
  const displayPrice    = selectedVariant?.salePrice ?? product.salePrice;

  const prices = variants.length > 0 ? variants.map((v) => v.salePrice ?? product.salePrice) : [product.salePrice];
  const minPrice = Math.min(...prices), maxPrice = Math.max(...prices);

  function handleAddToCart() {
    if (!isReady) return;
    if (variants.length > 0 && selectedIdx < 0) {
      toast.error("Please select a size first.");
      return;
    }
    if (selectedVariant && !isAvailable(selectedVariant)) {
      toast.error("This variant is not available for purchase.");
      return;
    }
    addItem({
      productId:    product.id,
      productTitle: product.title,
      productSlug:  product.slug,
      productImage: product.image,
      variantSize:  selectedVariant?.size ?? "",
      variantSku:   selectedVariant?.sku  ?? "",
      unitPrice:    displayPrice,
      quantity:     qty,
    });
    setJustAdded(true);
    toast.success("Added to cart!");
    setTimeout(() => setJustAdded(false), 2000);
  }

  const breadcrumb = [
    { label: "Home", href: basePath },
    product.category    ? { label: product.category.name,    href: basePath } : null,
    product.subCategory ? { label: product.subCategory.name, href: basePath } : null,
    { label: product.title, href: "#" },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <>
      {/* ── Product detail ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12">

        {/* Left — images */}
        <div className="space-y-3">
          <div className="relative rounded-2xl overflow-hidden bg-[#f8f9fa] border border-gray-100">
            <div className="aspect-square">
              {activeImage
                ? <img src={activeImage} alt={product.title} className="w-full h-full object-contain" />
                : <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-20 h-20 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
              }
            </div>
            {/* Zoom icon */}
            <div className="absolute top-3 right-3 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
            </div>
          </div>
          {allImages.length > 1 && (
            <div className="flex gap-2">
              {allImages.map((img, i) => (
                <button key={i} type="button" onClick={() => setActiveImage(img)}
                  className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-colors shrink-0 ${activeImage === img ? "border-gray-900" : "border-gray-100 hover:border-gray-300"}`}>
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right — info + buy */}
        <div>
          {/* Breadcrumb */}
          {/* <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-3">
            {breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span>/</span>}
                {i < breadcrumb.length - 1
                  ? <Link href={crumb.href} className="hover:text-[#3DBFA4] transition-colors">{crumb.label}</Link>
                  : <span className="text-gray-600">{crumb.label}</span>
                }
              </span>
            ))}
          </nav> */}

          {/* Category */}
          {product.category && (
            <p className="text-sm font-medium text-[#3DBFA4] mb-1">{product.category.name}</p>
          )}

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{product.title}</h1>

          {/* Base price */}
          <p className="text-xl font-bold text-gray-900 mb-3">
            {minPrice === maxPrice ? formatCurrency(minPrice) : `${formatCurrency(maxPrice)} – ${formatCurrency(minPrice)}`}
          </p>

          {/* Notice */}
          {/* <p className="text-sm text-[#3DBFA4] italic mb-5 leading-relaxed">
            This product is distributed only through participating medical practitioners and not to patients directly.
          </p> */}

          {/* Size selector */}
          {variants.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Size</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {variants.map((v, i) => {
                  const available = isAvailable(v);
                  const status    = variantStatus(v);
                  const isSelected = i === selectedIdx;
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={!available}
                      onClick={() => available && setSelectedIdx(i === selectedIdx ? -1 : i)}
                      className={`relative px-4 py-1.5 rounded border text-sm font-medium transition-all ${
                        !available
                          ? "bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed"
                          : isSelected
                            ? "bg-gray-900 text-white border-gray-900"
                            : "bg-white text-gray-700 border-gray-300 hover:border-gray-500"
                      }`}
                    >
                      {v.size}
                      {!available && (
                        <span className="block text-[9px] leading-tight mt-0.5 font-normal">
                          {status === "out_of_stock" ? "Out of Stock" : "Discontinued"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {selectedIdx >= 0 && (
                <button type="button" onClick={() => setSelectedIdx(-1)}
                  className="text-xs text-[#3DBFA4] hover:text-[#35a993] uppercase tracking-wide transition-colors">
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Selected price */}
          <p className="text-xl font-bold text-gray-900 mb-4">{formatCurrency(displayPrice)}</p>

          {/* Qty + Add to cart */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-50 text-lg leading-none transition-colors">−</button>
              <input type="number" value={qty} min={1} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-14 h-10 text-center text-sm font-semibold text-gray-800 border-0 focus:outline-none" />
              <button type="button" onClick={() => setQty((q) => q + 1)} className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-50 text-lg leading-none transition-colors">+</button>
            </div>
            <button type="button" onClick={handleAddToCart} disabled={!isReady}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-white text-sm font-bold rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors ${justAdded ? "bg-[#3DBFA4]" : "bg-gray-900 hover:bg-gray-700"}`}>
              {!isReady && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {!isReady ? "Loading…" : justAdded ? "Added ✓" : "Add to cart"}
            </button>
          </div>

          {/* Meta */}
          <div className="text-xs hidden text-gray-500 space-y-1 pt-3 border-t border-gray-100">
            {selectedVariant?.sku && <p><span className="font-medium text-gray-700">SKU:</span> {selectedVariant.sku}</p>}
            {product.category && <p><span className="font-medium text-gray-700">Category:</span>{" "}
              <span className="text-[#3DBFA4]">{product.category.name}</span>
            </p>}
            {product.tags.length > 0 && (
              <p><span className="font-medium text-gray-700">Tags:</span> {product.tags.join(", ")}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-0">
          {(["info", "reviews"] as const).map((tab) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-gray-900 text-[#3DBFA4]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}>
              {tab === "info" ? "Additional information" : "Reviews (0)"}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "info" && (
        <div className="mb-12">
          {variants.length > 0 ? (
            <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-700 bg-gray-50 w-40">Size</td>
                  <td className="px-4 py-3 text-gray-600">
                    {variants.map((v) => v.size).filter(Boolean).join(", ")}
                  </td>
                </tr>
                {product.description && (
                  <tr>
                    <td className="px-4 py-3 font-medium text-gray-700 bg-gray-50">Description</td>
                    <td className="px-4 py-3 text-gray-600">{product.description}</td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-500">{product.description ?? "No additional information available."}</p>
          )}
        </div>
      )}

      {activeTab === "reviews" && (
        <div className="mb-12">
          <p className="text-sm text-gray-500">No reviews yet.</p>
        </div>
      )}

      {/* ── Related products ──────────────────────────────────── */}
      {related.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-5">Related products</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {related.map((p) => (
              <RelatedCard key={p.id} p={p} basePath={basePath} />
            ))}
          </div>
        </div>
      )}

      {/* Quick order modal */}
      {showModal && (
        <QuickOrderModal
          product={{ id: product.id, title: product.title, salePrice: product.salePrice }}
          variantSize={selectedVariant?.size ?? ""}
          variantSku={selectedVariant?.sku ?? ""}
          unitPrice={displayPrice}
          qty={qty}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
