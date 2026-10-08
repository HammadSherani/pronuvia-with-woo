import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/dal";
import { getAdminProducts, type AdminProduct } from "@/lib/woo/catalog";
import { wpAdmin } from "@/lib/woo/admin-links";
import { PageHeader } from "@/components/admin/page-header";
import { WooManagedNotice } from "@/components/admin/woo-managed-notice";
import { Pagination } from "@/components/shared/pagination";
import { parsePagination } from "@/lib/pagination";
import { formatCurrency } from "@/lib/utils/currency";

export const metadata = { title: "Products – Pronuvia Admin" };

const STATUS_STYLES: Record<AdminProduct["status"], string> = {
  ACTIVE:   "bg-emerald-50 text-emerald-700",
  DRAFT:    "bg-amber-50 text-amber-700",
  ARCHIVED: "bg-gray-100 text-gray-500",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const { page, pageSize, skip, take } = parsePagination(sp);

  let products: AdminProduct[] | null = null;
  try {
    products = await getAdminProducts();
  } catch (e) {
    console.error("[admin/products] WooCommerce failed:", e);
  }
  const total = products?.length ?? 0;
  const pageItems = products?.slice(skip, skip + take) ?? [];

  return (
    <div>
      <PageHeader title="Products" description={`Product catalogue from WooCommerce (${total} total)`} />
      <WooManagedNotice what="Products" href={wpAdmin.products()} />

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {products === null ? (
          <p className="py-16 text-center text-sm text-gray-500">Could not load products from WooCommerce. Please refresh.</p>
        ) : total === 0 ? (
          <p className="py-16 text-center text-sm text-gray-500">No products in WooCommerce yet.</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">SKU</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pageItems.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                          {p.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.image} alt={p.title} className="w-full h-full object-cover" />
                          ) : (
                            <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <span className="font-medium text-gray-800 line-clamp-1">{p.title}</span>
                          {p.variants.length > 1 && (
                            <span className="text-xs text-gray-400">{p.variants.map((v) => v.size).join(", ")}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 font-mono text-xs">
                      {p.variants.map((v) => v.sku).filter(Boolean).join(", ") || p.sku || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {p.category ? (
                        <span>
                          {p.category.name}
                          {p.subCategory && <span className="text-gray-400"> / {p.subCategory.name}</span>}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-gray-800">{formatCurrency(p.salePrice)}</td>
                    <td className="px-5 py-3.5 text-gray-600">
                      {p.variants.length > 0 && p.variants.every((v) => v.status !== "in_stock")
                        ? <span className="text-red-500 font-medium">Out of stock</span>
                        : (p.stock ?? "—")}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[p.status]}`}>
                        {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <a href={wpAdmin.editProduct(p.id)} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-medium text-[#5BB8D4] hover:text-[#3a9db8] transition-colors">
                        Edit in WooCommerce
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Suspense>
              <Pagination total={total} page={page} pageSize={pageSize} />
            </Suspense>
          </>
        )}
      </div>
    </div>
  );
}
