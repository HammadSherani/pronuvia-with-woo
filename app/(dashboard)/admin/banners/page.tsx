import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { PageHeader } from "@/components/admin/page-header";
import { DeleteButton } from "@/components/admin/delete-button";
import { deleteBanner } from "@/actions/admin/banners";
import { BannerPublishToggle } from "@/app/(dashboard)/admin/banners/_components/banner-publish-toggle";
import { Pagination } from "@/components/shared/pagination";
import { parsePagination } from "@/lib/pagination";
import { Suspense } from "react";

export const metadata = { title: "Banners – Pronuvia Admin" };

export default async function BannersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const { page, pageSize, skip, take } = parsePagination(sp);

  const [banners, total] = await Promise.all([
    prisma.banner.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      skip,
      take,
    }),
    prisma.banner.count(),
  ]);

  return (
    <div>
      <PageHeader
        title="Promotional Banners"
        description={`Add banners that appear on sales rep and physician dashboards (${total} total)`}
        actionLabel="Add Banner"
        actionHref="/admin/banners/new"
      />

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500">No banners yet</p>
            <Link href="/admin/banners/new" className="mt-3 text-sm text-[#3DBFA4] hover:underline font-medium">
              Add your first banner
            </Link>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Banner</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Order</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {banners.map((banner) => (
                  <tr key={banner.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="w-24 h-14 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={banner.imageUrl} alt={banner.title} className="w-full h-full object-cover" />
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-800">{banner.title}</p>
                      {banner.linkUrl && (
                        <p className="text-xs text-gray-400 truncate max-w-[200px] mt-0.5">{banner.linkUrl}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">{banner.sortOrder}</td>
                    <td className="px-5 py-3.5">
                      <BannerPublishToggle id={banner.id} isPublished={banner.isPublished} />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-4 justify-end">
                        <Link href={`/admin/banners/${banner.id}/edit`}
                          className="text-xs font-medium text-[#5BB8D4] hover:text-[#3a9db8] transition-colors">
                          Edit
                        </Link>
                        <DeleteButton action={deleteBanner.bind(null, banner.id)} />
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
