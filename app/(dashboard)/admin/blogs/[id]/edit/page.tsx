import { notFound }     from "next/navigation";
import { prisma }       from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { PageHeader }   from "@/components/admin/page-header";
import { BlogForm }     from "@/components/admin/blog-form";
import { updateBlog }   from "@/actions/admin/blogs";

export const metadata = { title: "Edit Blog Post – Pronuvia Admin" };

export default async function EditBlogPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const post = await prisma.blog.findUnique({ where: { id } });
  if (!post) notFound();

  const boundAction = updateBlog.bind(null, id);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Edit Blog Post" description="Update post details" />
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <BlogForm
          action={boundAction}
          defaultValues={{
            title:       post.title,
            slug:        post.slug,
            excerpt:     post.excerpt     ?? undefined,
            content:     post.content     ?? undefined,
            imageUrl:    post.imageUrl    ?? undefined,
            isPublished: post.isPublished,
          }}
        />
      </div>
    </div>
  );
}
