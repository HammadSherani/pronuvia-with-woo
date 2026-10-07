import { notFound } from "next/navigation";
import Link         from "next/link";
import { prisma }   from "@/lib/db/prisma";
import { SiteHeaderWrapper as SiteHeader } from "@/components/website/site-header-wrapper";
import { SiteFooter } from "@/components/website/site-footer";
import { formatDateLong } from "@/lib/utils/timezone";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await prisma.blog.findUnique({ where: { slug }, select: { title: true, excerpt: true } });
  if (!post) return {};
  return { title: `${post.title} – Pronuvia Research`, description: post.excerpt ?? undefined };
}

export default async function ResearchDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const post = await prisma.blog.findUnique({
    where:  { slug, isPublished: true },
    select: { title: true, excerpt: true, content: true, imageUrl: true, publishedAt: true, createdAt: true },
  });

  if (!post) notFound();

  const date = post.publishedAt ?? post.createdAt;

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader variant="solid" />

      <main className="max-w-3xl mx-auto px-6 pt-12 pb-24">

        {/* Back */}
        <Link
          href="/research"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-8"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Research
        </Link>

        {/* Title */}
        <h1
          className="text-3xl lg:text-4xl font-normal text-ink leading-tight mb-6"
          style={{ fontFamily: "var(--font-display), Georgia, serif" }}
        >
          {post.title}
        </h1>

        {/* Date */}
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-8">
          {formatDateLong(date)}
        </p>

        {/* Image inside content area */}
        {post.imageUrl && (
          <div className="w-full overflow-hidden rounded-sm mb-10 bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.imageUrl}
              alt={post.title}
              className="w-full h-auto object-cover"
            />
          </div>
        )}

        {/* Excerpt */}
        {post.excerpt && (
          <p className="text-base text-gray-500 leading-relaxed mb-8 border-l-4 border-ion pl-4">
            {post.excerpt}
          </p>
        )}

        {/* Rich text content */}
        {post.content ? (
          <div
            className="
              prose prose-gray max-w-none
              prose-headings:font-bold prose-headings:text-ink
              prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-3
              prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-2
              prose-p:text-gray-600 prose-p:leading-relaxed prose-p:my-4
              prose-a:text-ion prose-a:underline
              prose-strong:text-ink
              prose-blockquote:border-l-4 prose-blockquote:border-ion prose-blockquote:text-gray-500 prose-blockquote:pl-4 prose-blockquote:italic
              prose-ul:list-disc prose-ul:pl-5
              prose-ol:list-decimal prose-ol:pl-5
              prose-li:text-gray-600 prose-li:my-1
              prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
              prose-hr:border-gray-200 prose-hr:my-8
              prose-img:rounded-sm prose-img:w-full
            "
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        ) : (
          <p className="text-gray-400 text-sm">No content available.</p>
        )}

      </main>

      <SiteFooter />
    </div>
  );
}
