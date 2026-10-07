import { requireAdmin }  from "@/lib/auth/dal";
import { PageHeader }    from "@/components/admin/page-header";
import { BlogForm }      from "@/components/admin/blog-form";
import { createBlog }    from "@/actions/admin/blogs";

export const metadata = { title: "New Blog Post – Pronuvia Admin" };

export default async function NewBlogPage() {
  await requireAdmin();

  return (
    <div className="max-w-3xl">
      <PageHeader title="Add Blog Post" description="Create a new post for the public website" />
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <BlogForm action={createBlog} />
      </div>
    </div>
  );
}
