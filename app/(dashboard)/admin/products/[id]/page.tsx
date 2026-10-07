import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { getProductById } from "@/actions/admin/products";
import { formatDateLong } from "@/lib/utils/timezone";
import { formatCurrency } from "@/lib/utils/currency";

type SizeVariant = {
  size: string; sku?: string; gtin?: string; image?: string;
  costPrice?: number; salePrice?: number; stock?: number; weight?: number;
  status?: string;
};

const VARIANT_STATUS_STYLES: Record<string, string> = {
  in_stock:     "bg-emerald-50 text-emerald-700 border border-emerald-200",
  out_of_stock: "bg-amber-50  text-amber-700  border border-amber-200",
  discontinued: "bg-red-50    text-red-700    border border-red-200",
  inactive:     "bg-gray-100  text-gray-500   border border-gray-200",
};
const VARIANT_STATUS_LABELS: Record<string, string> = {
  in_stock:     "In Stock",
  out_of_stock: "Out of Stock",
  discontinued: "Discontinued",
  inactive:     "Inactive",
};

const STATUS_STYLES = {
  ACTIVE:   "bg-emerald-50 text-emerald-700 border border-emerald-200",
  DRAFT:    "bg-amber-50 text-amber-700 border border-amber-200",
  ARCHIVED: "bg-gray-100 text-gray-500 border border-gray-200",
};

function fmt(n?: number | null) { return n != null ? formatCurrency(n) : "—"; }
function fmtN(n?: number | null) { return n != null ? String(n) : "—"; }

type Props = { params: Promise<{ id: string }> };

export default async function ProductViewPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const product = await getProductById(id);
  if (!product) notFound();

  const variants = (product.variants ?? []) as SizeVariant[];

  return (
    <div className="">
      {/* Breadcrumb / actions */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/admin/products"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Products
        </Link>
        <Link href={`/admin/products/${id}/edit`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#3DBFA4] text-white text-sm font-medium rounded-lg hover:bg-[#35a993] transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit Product
        </Link>
      </div>

      {/* Title + status */}
      <div className="flex items-start gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex-1">{product.title}</h1>
        <span className={`shrink-0 mt-1 inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[product.status]}`}>
          {product.status.charAt(0) + product.status.slice(1).toLowerCase()}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-5 mb-5">
        {/* Main image */}
        <div className="col-span-1">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden aspect-square flex items-center justify-center">
            {product.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
            ) : (
              <svg className="w-16 h-16 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </div>
        </div>

        {/* Meta info */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-3 border-b border-gray-100">Product Details</h2>
          <dl className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-gray-400 font-medium mb-0.5">Category</dt>
                <dd className="text-sm text-gray-700">{product.category ? (product as { category?: { name: string } }).category?.name : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 font-medium mb-0.5">Sub-Category</dt>
                <dd className="text-sm text-gray-700">{product.subCategory ? (product as { subCategory?: { name: string } }).subCategory?.name : "—"}</dd>
              </div>
            </div>
            <div>
              <dt className="text-xs text-gray-400 font-medium mb-0.5">Tags</dt>
              <dd className="flex flex-wrap gap-1.5 mt-1">
                {product.tags.length ? product.tags.map((t) => (
                  <span key={t} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">{t}</span>
                )) : <span className="text-sm text-gray-400">—</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400 font-medium mb-0.5">Created</dt>
              <dd className="text-sm text-gray-700">{formatDateLong(product.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400 font-medium mb-0.5">Last Updated</dt>
              <dd className="text-sm text-gray-700">{formatDateLong(product.updatedAt)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Description */}
      {product.description && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Description</h2>
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{product.description}</p>
        </div>
      )}

      {/* Gallery */}
      {product.imageGallery.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Gallery Images</h2>
          <div className="grid grid-cols-5 gap-3">
            {product.imageGallery.map((url, i) => (
              <div key={i} className="aspect-square rounded-lg overflow-hidden border border-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Variants table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-5">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">
            Sizes & Variants
            <span className="ml-2 text-xs font-normal text-gray-400">({variants.length} {variants.length === 1 ? "variant" : "variants"})</span>
          </h2>
        </div>

        {variants.length === 0 ? (
          <p className="text-sm text-gray-400 px-6 py-8 text-center">No variants added.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Image</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Size</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">SKU</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">GTIN</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cost</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sale Price</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Weight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {variants.map((v, i) => (
                  <tr key={i} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 shrink-0 flex items-center justify-center">
                        {v.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={v.image} alt={v.size} className="w-full h-full object-cover" />
                        ) : (
                          <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{v.size}</td>
                    <td className="px-4 py-3">
                      {(() => {
                        const s = v.status ?? "in_stock";
                        return (
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${VARIANT_STATUS_STYLES[s] ?? VARIANT_STATUS_STYLES.inactive}`}>
                            {VARIANT_STATUS_LABELS[s] ?? s}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{v.sku || "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{v.gtin || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{fmt(v.costPrice)}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">{fmt(v.salePrice)}</td>
                    <td className="px-4 py-3 text-gray-600">{fmtN(v.stock)}</td>
                    <td className="px-4 py-3 text-gray-600">{v.weight != null ? `${v.weight} kg` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
