import { getAdminCategories, type AdminCategory } from "@/lib/woo/catalog";
import { wpAdmin } from "@/lib/woo/admin-links";
import { PageHeader } from "@/components/admin/page-header";
import { WooManagedNotice } from "@/components/admin/woo-managed-notice";

// Read-only list of WooCommerce product categories. "top" = parent categories,
// "sub" = child categories (the old Sub-Categories).
export async function WooCategoriesPage({ level }: { level: "top" | "sub" }) {
  let categories: AdminCategory[] | null = null;
  try {
    categories = (await getAdminCategories()).filter((c) => (level === "top" ? !c.parent : !!c.parent));
  } catch (e) {
    console.error("[admin/categories] WooCommerce failed:", e);
  }

  const title = level === "top" ? "Categories" : "Sub-Categories";

  return (
    <div>
      <PageHeader title={title} description={`Product ${title.toLowerCase()} from WooCommerce (${categories?.length ?? 0} total)`} />
      <WooManagedNotice what="Categories" href={wpAdmin.categories()} />

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {categories === null ? (
          <p className="py-16 text-center text-sm text-gray-500">Could not load categories from WooCommerce. Please refresh.</p>
        ) : categories.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-500">No {title.toLowerCase()} in WooCommerce yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Slug</th>
                {level === "sub" && (
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                )}
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Products</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {categories.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4 font-medium text-gray-800">{c.name}</td>
                  <td className="px-5 py-4 text-gray-400 font-mono text-xs">{c.slug}</td>
                  {level === "sub" && (
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
                        {c.parent?.name}
                      </span>
                    </td>
                  )}
                  <td className="px-5 py-4 text-gray-600">{c.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
