import Link            from "next/link";
import { prisma }      from "@/lib/db/prisma";
import { requireAdmin }       from "@/lib/auth/dal";
import { PageHeader }         from "@/components/admin/page-header";
import { DeleteButton }       from "@/components/admin/delete-button";
import { deleteBlog }         from "@/actions/admin/blogs";
import { BlogPublishToggle }  from "./_components/publish-toggle";
import { Pagination } from "@/components/shared/pagination";
import { formatDate } from "@/lib/utils/timezone";
import { parsePagination } from "@/lib/pagination";
import { Suspense } from "react";

export const metadata = { title: "Blog Posts – Pronuvia Admin" };

export default async function BlogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const { page, pageSize, skip, take } = parsePagination(sp);

  const [posts, total] = await Promise.all([
    prisma.blog.findMany({ orderBy: { createdAt: "desc" }, skip, take }),
    prisma.blog.count(),
  ]);

  return (
    <div>
      <PageHeader
        title="Blog Posts"
        description={`Manage blog posts shown on the public website (${total} total)`}
        actionLabel="Add Post"
        actionHref="/admin/blogs/new"
      />

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500">No blog posts yet</p>
            <Link href="/admin/blogs/new" className="mt-3 text-sm text-[#3DBFA4] hover:underline font-medium">
              Add your first post
            </Link>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Post</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Slug</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {posts.map((post) => (
                  <tr key={post.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {post.imageUrl ? (
                          <div className="w-16 h-12 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-16 h-12 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center">
                            <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-800 line-clamp-1">{post.title}</p>
                          {post.excerpt && <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{post.excerpt}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">{post.slug}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <BlogPublishToggle id={post.id} isPublished={post.isPublished} />
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-400">
                      {formatDate(post.createdAt)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-4 justify-end">
                        <Link href={`/admin/blogs/${post.id}/edit`}
                          className="text-xs font-medium text-[#5BB8D4] hover:text-[#3a9db8] transition-colors">
                          Edit
                        </Link>
                        <DeleteButton action={deleteBlog.bind(null, post.id)} />
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
