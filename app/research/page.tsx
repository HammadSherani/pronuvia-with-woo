import Link   from "next/link";
import { prisma } from "@/lib/db/prisma";
import { SiteHeaderWrapper as SiteHeader } from "@/components/website/site-header-wrapper";
import { SiteFooter } from "@/components/website/site-footer";
import { formatDateLong } from "@/lib/utils/timezone";

export const metadata = { title: "Research – Pronuvia" };

export default async function ResearchPage() {
  const posts = await prisma.blog.findMany({
    where:   { isPublished: true },
    orderBy: { publishedAt: "desc" },
    select:  { id: true, title: true, slug: true, excerpt: true, imageUrl: true, publishedAt: true, createdAt: true },
  });

  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader variant="solid" />

      <main className="max-w-6xl mx-auto px-6 lg:px-8 pt-12 pb-16">

        {/* Page heading */}
        <div className="mb-8 border-b border-gray-200 pb-4">
          <p className="eyebrow mb-1">Pronuvia</p>
          <h1
            className="text-3xl leading-tight text-ink"
            style={{ fontFamily: "var(--font-display), Georgia, serif", fontWeight: 400 }}
          >
            Research
          </h1>
        </div>

        {/* Grid */}
        {posts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-sm">No research articles published yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
            {posts.map(post => {
              const date = post.publishedAt ?? post.createdAt;
              return (
                <article key={post.id} className="group flex flex-col">
                  {/* Image */}
                  <Link href={`/research/${post.slug}`}>
                    <div className="aspect-[16/10] overflow-hidden rounded-sm bg-gray-100 mb-3">
                      {post.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={post.imageUrl}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                          <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Date */}
                  <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mb-1.5">
                    {formatDateLong(date)}
                  </p>

                  {/* Title */}
                  <Link href={`/research/${post.slug}`}>
                    <h2
                      className="text-base font-semibold text-ink leading-snug mb-2 group-hover:text-ion transition-colors"
                      style={{ fontFamily: "var(--font-display), Georgia, serif" }}
                    >
                      {post.title}
                    </h2>
                  </Link>

                  {/* Excerpt */}
                  {post.excerpt && (
                    <p className="text-xs text-foreground/60 leading-relaxed line-clamp-3 mb-3 flex-1">
                      {post.excerpt}
                    </p>
                  )}

                  {/* Read More */}
                  <Link
                    href={`/research/${post.slug}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-ion hover:gap-2 transition-all"
                  >
                    Read More
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 10h12M11 5l5 5-5 5" />
                    </svg>
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
