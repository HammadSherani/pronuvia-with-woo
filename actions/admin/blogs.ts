"use server";

import { revalidatePath } from "next/cache";
import { prisma }         from "@/lib/db/prisma";
import { requireAdmin }   from "@/lib/auth/dal";
import { z }              from "zod";

const Schema = z.object({
  title:       z.string().min(1, "Title is required"),
  slug:        z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  excerpt:     z.string().optional(),
  content:     z.string().optional(),
  imageUrl:    z.string().optional(),
  isPublished: z.boolean().default(false),
});

export type BlogActionState = {
  errors?: Record<string, string[]>;
  message?: string;
  success?: boolean;
} | undefined;

function toSlug(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function createBlog(
  _state: BlogActionState,
  formData: FormData
): Promise<BlogActionState> {
  await requireAdmin();

  const title = formData.get("title") as string;
  const rawSlug = (formData.get("slug") as string) || toSlug(title);

  const validated = Schema.safeParse({
    title,
    slug:        rawSlug,
    excerpt:     (formData.get("excerpt") as string) || undefined,
    content:     (formData.get("content") as string) || undefined,
    imageUrl:    (formData.get("imageUrl") as string) || undefined,
    isPublished: formData.get("isPublished") === "true",
  });

  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors };
  }

  const existing = await prisma.blog.findUnique({ where: { slug: validated.data.slug } });
  if (existing) return { errors: { slug: ["This slug is already in use."] } };

  await prisma.blog.create({
    data: {
      ...validated.data,
      publishedAt: validated.data.isPublished ? new Date() : null,
    },
  });

  revalidatePath("/admin/blogs");
  revalidatePath("/");
  return { success: true, message: "Blog post created successfully." };
}

export async function updateBlog(
  id: string,
  _state: BlogActionState,
  formData: FormData
): Promise<BlogActionState> {
  await requireAdmin();

  const title = formData.get("title") as string;
  const rawSlug = (formData.get("slug") as string) || toSlug(title);

  const validated = Schema.safeParse({
    title,
    slug:        rawSlug,
    excerpt:     (formData.get("excerpt") as string) || undefined,
    content:     (formData.get("content") as string) || undefined,
    imageUrl:    (formData.get("imageUrl") as string) || undefined,
    isPublished: formData.get("isPublished") === "true",
  });

  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors };
  }

  const existing = await prisma.blog.findUnique({ where: { slug: validated.data.slug } });
  if (existing && existing.id !== id) return { errors: { slug: ["This slug is already in use."] } };

  const current = await prisma.blog.findUnique({ where: { id }, select: { isPublished: true, publishedAt: true } });

  await prisma.blog.update({
    where: { id },
    data: {
      ...validated.data,
      publishedAt: validated.data.isPublished && !current?.publishedAt ? new Date() : current?.publishedAt ?? null,
    },
  });

  revalidatePath("/admin/blogs");
  revalidatePath("/");
  return { success: true, message: "Blog post updated successfully." };
}

export async function deleteBlog(id: string): Promise<BlogActionState> {
  await requireAdmin();
  await prisma.blog.delete({ where: { id } });
  revalidatePath("/admin/blogs");
  revalidatePath("/");
  return { success: true };
}

export async function toggleBlogPublished(id: string, isPublished: boolean): Promise<void> {
  await requireAdmin();
  await prisma.blog.update({
    where: { id },
    data: {
      isPublished,
      publishedAt: isPublished ? new Date() : null,
    },
  });
  revalidatePath("/admin/blogs");
  revalidatePath("/");
}
