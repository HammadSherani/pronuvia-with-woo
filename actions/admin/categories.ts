"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { toSlug } from "@/lib/utils/slug";

const CategorySchema = z.object({
  name: z.string().min(1, "Name is required").trim(),
  description: z.string().optional(),
});

export type CategoryActionState = {
  errors?: Record<string, string[]>;
  message?: string;
  success?: boolean;
} | undefined;

export async function createCategory(
  _state: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  await requireAdmin();

  const validated = CategorySchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });

  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors };
  }

  const { name, description } = validated.data;
  const slug = toSlug(name);

  const exists = await prisma.category.findUnique({ where: { slug } });
  if (exists) {
    return { errors: { name: ["A category with this name already exists."] } };
  }

  await prisma.category.create({
    data: { name, slug, description, isActive: true },
  });

  revalidatePath("/admin/categories");
  return { success: true, message: "Category created successfully." };
}

export async function updateCategory(
  id: string,
  _state: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  await requireAdmin();

  const validated = CategorySchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });

  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors };
  }

  const { name, description } = validated.data;
  const slug = toSlug(name);

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) return { message: "Category not found." };

  if (slug !== existing.slug) {
    const taken = await prisma.category.findUnique({ where: { slug } });
    if (taken) {
      return { errors: { name: ["A category with this name already exists."] } };
    }
  }

  await prisma.category.update({
    where: { id },
    data: { name, slug, description },
  });

  revalidatePath("/admin/categories");
  return { success: true, message: "Category updated successfully." };
}

export async function deleteCategory(id: string): Promise<CategoryActionState> {
  await requireAdmin();

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) return { message: "Category not found." };

  await prisma.category.delete({ where: { id } });
  revalidatePath("/admin/categories");
  return { success: true };
}

export async function getCategories(opts?: { skip?: number; take?: number }) {
  await requireAdmin();
  const [categories, total] = await Promise.all([
    prisma.category.findMany({
      include: { _count: { select: { subCategories: true } } },
      orderBy: { createdAt: "desc" },
      skip: opts?.skip,
      take: opts?.take,
    }),
    prisma.category.count(),
  ]);
  return { categories, total };
}

export async function getCategoryById(id: string) {
  await requireAdmin();
  return prisma.category.findUnique({ where: { id } });
}
