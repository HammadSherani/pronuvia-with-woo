import Link from "next/link";
import { getSubCategories, deleteSubCategory } from "@/actions/admin/sub-categories";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { DeleteButton } from "@/components/admin/delete-button";
import { Pagination } from "@/components/shared/pagination";
import { parsePagination } from "@/lib/pagination";
import { Suspense } from "react";
import { formatDate } from "@/lib/utils/timezone";

export const metadata = { title: "Sub-Categories – Pronuvia Admin" };

export default async function SubCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { page, pageSize, skip, take } = parsePagination(sp);
  const { subCategories, total } = await getSubCategories({ skip, take });

  return (
    <div>
      <PageHeader
        title="Sub-Categories"
        description={`Manage product sub-categories (${total} total)`}
        actionLabel="Add Sub-Category"
        actionHref="/admin/sub-categories/new"
      />

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500">No sub-categories yet</p>
            <Link href="/admin/sub-categories/new" className="mt-3 text-sm text-[#3DBFA4] hover:underline font-medium">
              Add your first sub-category
            </Link>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Slug</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {subCategories.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4 font-medium text-gray-800">{sub.name}</td>
                    <td className="px-5 py-4 text-gray-400 font-mono text-xs">{sub.slug}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
                        {sub.category.name}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge active={sub.isActive} />
                    </td>
                    <td className="px-5 py-4 text-gray-400 text-xs">
                      {formatDate(sub.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-4 justify-end">
                        <Link href={`/admin/sub-categories/${sub.id}/edit`} className="text-xs font-medium text-[#5BB8D4] hover:text-[#3a9db8] transition-colors">
                          Edit
                        </Link>
                        <DeleteButton action={deleteSubCategory.bind(null, sub.id)} />
                      </div>
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
