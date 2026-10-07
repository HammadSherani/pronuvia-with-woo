"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { toSlug } from "@/lib/utils/slug";

const SubCategorySchema = z.object({
  name: z.string().min(1, "Name is required").trim(),
  categoryId: z.string().min(1, "Category is required"),
  description: z.string().optional(),
});

export type SubCategoryActionState = {
  errors?: Record<string, string[]>;
  message?: string;
  success?: boolean;
} | undefined;

export async function createSubCategory(
  _state: SubCategoryActionState,
  formData: FormData
): Promise<SubCategoryActionState> {
  await requireAdmin();

  const validated = SubCategorySchema.safeParse({
    name: formData.get("name"),
    categoryId: formData.get("categoryId"),
    description: formData.get("description") || undefined,
  });

  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors };
  }

  const { name, categoryId, description } = validated.data;
  const slug = toSlug(name);

  const exists = await prisma.subCategory.findUnique({ where: { slug } });
  if (exists) {
    return { errors: { name: ["A sub-category with this name already exists."] } };
  }

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) {
    return { errors: { categoryId: ["Selected category does not exist."] } };
  }

  await prisma.subCategory.create({
    data: { name, slug, categoryId, description, isActive: true },
  });

  revalidatePath("/admin/sub-categories");
  return { success: true, message: "Sub-category created successfully." };
}

export async function updateSubCategory(
  id: string,
  _state: SubCategoryActionState,
  formData: FormData
): Promise<SubCategoryActionState> {
  await requireAdmin();

  const validated = SubCategorySchema.safeParse({
    name: formData.get("name"),
    categoryId: formData.get("categoryId"),
    description: formData.get("description") || undefined,
  });

  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors };
  }

  const { name, categoryId, description } = validated.data;
  const slug = toSlug(name);

  const existing = await prisma.subCategory.findUnique({ where: { id } });
  if (!existing) return { message: "Sub-category not found." };

  if (slug !== existing.slug) {
    const taken = await prisma.subCategory.findUnique({ where: { slug } });
    if (taken) {
      return { errors: { name: ["A sub-category with this name already exists."] } };
    }
  }

  await prisma.subCategory.update({
    where: { id },
    data: { name, slug, categoryId, description },
  });

  revalidatePath("/admin/sub-categories");
  return { success: true, message: "Sub-category updated successfully." };
}

export async function deleteSubCategory(
  id: string
): Promise<SubCategoryActionState> {
  await requireAdmin();

  const existing = await prisma.subCategory.findUnique({ where: { id } });
  if (!existing) return { message: "Sub-category not found." };

  await prisma.subCategory.delete({ where: { id } });
  revalidatePath("/admin/sub-categories");
  return { success: true };
}

export async function getSubCategories(opts?: { skip?: number; take?: number }) {
  await requireAdmin();
  const [subCategories, total] = await Promise.all([
    prisma.subCategory.findMany({
      include: { category: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      skip: opts?.skip,
      take: opts?.take,
    }),
    prisma.subCategory.count(),
  ]);
  return { subCategories, total };
}

export async function getSubCategoryById(id: string) {
  await requireAdmin();
  return prisma.subCategory.findUnique({
    where: { id },
    include: { category: { select: { id: true, name: true } } },
  });
}
