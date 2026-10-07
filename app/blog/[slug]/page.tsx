import { notFound } from "next/navigation";
import Link         from "next/link";
import { prisma }   from "@/lib/db/prisma";
import { SiteHeaderWrapper as SiteHeader } from "@/components/website/site-header-wrapper";
import { formatDateLong } from "@/lib/utils/timezone";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await prisma.blog.findUnique({ where: { slug }, select: { title: true, excerpt: true } });
  if (!post) return {};
  return { title: `${post.title} – Pronuvia`, description: post.excerpt ?? undefined };
}

export default async function BlogDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const post = await prisma.blog.findUnique({
    where:  { slug, isPublished: true },
    select: { title: true, excerpt: true, content: true, imageUrl: true, publishedAt: true },
  });

  if (!post) notFound();

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      {/* Hero image */}
      {post.imageUrl && (
        <div className="w-full h-[420px] bg-gray-100 overflow-hidden pt-16">
          <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Content */}
      <div className={`max-w-3xl mx-auto px-6 pb-20 ${post.imageUrl ? "pt-12" : "pt-28"}`}>

        {/* Back */}
        <Link href="/#blog"
          className="inline-flex items-center gap-1.5 text-sm text-[#3DBFA4] hover:underline mb-8">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to blog
        </Link>

        {/* Date */}
        {post.publishedAt && (
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-4">
            {formatDateLong(post.publishedAt)}
          </p>
        )}

        {/* Title */}
        <h1
          className="text-4xl lg:text-5xl font-normal text-gray-900 leading-tight mb-6"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          {post.title}
        </h1>

        {/* Excerpt */}
        {post.excerpt && (
          <p className="text-lg text-gray-500 leading-relaxed mb-8 border-l-4 border-[#3DBFA4] pl-4">
            {post.excerpt}
          </p>
        )}

        <hr className="border-gray-100 mb-8" />

        {/* Rich text content */}
        {post.content ? (
          <div
            className="prose prose-gray max-w-none text-sm leading-relaxed
              prose-headings:font-bold prose-headings:text-gray-900
              prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl
              prose-p:text-gray-600 prose-p:my-3
              prose-a:text-[#3DBFA4] prose-a:underline
              prose-blockquote:border-l-4 prose-blockquote:border-[#3DBFA4] prose-blockquote:text-gray-500 prose-blockquote:pl-4
              prose-ul:list-disc prose-ul:pl-5 prose-ol:list-decimal prose-ol:pl-5
              prose-li:text-gray-600 prose-li:my-1
              prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
              prose-hr:border-gray-200"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        ) : (
          <p className="text-gray-400 text-sm">No content available.</p>
        )}
      </div>
    </div>
  );
}
