"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { z } from "zod";

const BannerSchema = z.object({
  title:       z.string().min(1, "Title is required"),
  imageUrl:    z.string().min(1, "Image is required"),
  linkUrl:     z.string().url("Must be a valid URL").or(z.literal("")).optional(),
  isPublished: z.boolean().default(false),
  sortOrder:   z.number().int().default(0),
});

export type BannerActionState = {
  errors?: Record<string, string[]>;
  message?: string;
  success?: boolean;
} | undefined;

export async function createBanner(
  _state: BannerActionState,
  formData: FormData
): Promise<BannerActionState> {
  await requireAdmin();

  const raw = {
    title:       formData.get("title") as string,
    imageUrl:    formData.get("imageUrl") as string,
    linkUrl:     (formData.get("linkUrl") as string) || "",
    isPublished: formData.get("isPublished") === "true",
    sortOrder:   Number(formData.get("sortOrder") ?? 0),
  };

  const validated = BannerSchema.safeParse(raw);
  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors };
  }

  await prisma.banner.create({
    data: {
      title:       validated.data.title,
      imageUrl:    validated.data.imageUrl,
      linkUrl:     validated.data.linkUrl || null,
      isPublished: validated.data.isPublished,
      sortOrder:   validated.data.sortOrder,
    },
  });

  revalidatePath("/admin/banners");
  return { success: true, message: "Banner created successfully." };
}

export async function updateBanner(
  id: string,
  _state: BannerActionState,
  formData: FormData
): Promise<BannerActionState> {
  await requireAdmin();

  const raw = {
    title:       formData.get("title") as string,
    imageUrl:    formData.get("imageUrl") as string,
    linkUrl:     (formData.get("linkUrl") as string) || "",
    isPublished: formData.get("isPublished") === "true",
    sortOrder:   Number(formData.get("sortOrder") ?? 0),
  };

  const validated = BannerSchema.safeParse(raw);
  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors };
  }

  await prisma.banner.update({
    where: { id },
    data: {
      title:       validated.data.title,
      imageUrl:    validated.data.imageUrl,
      linkUrl:     validated.data.linkUrl || null,
      isPublished: validated.data.isPublished,
      sortOrder:   validated.data.sortOrder,
    },
  });

  revalidatePath("/admin/banners");
  return { success: true, message: "Banner updated successfully." };
}

export async function deleteBanner(id: string): Promise<BannerActionState> {
  await requireAdmin();
  await prisma.banner.delete({ where: { id } });
  revalidatePath("/admin/banners");
  return { success: true };
}

export async function toggleBannerPublished(
  id: string,
  isPublished: boolean
): Promise<void> {
  await requireAdmin();
  await prisma.banner.update({ where: { id }, data: { isPublished } });
  revalidatePath("/admin/banners");
}

export async function getPublishedBanners() {
  return prisma.banner.findMany({
    where:   { isPublished: true },
    orderBy: { sortOrder: "asc" },
    select:  { id: true, title: true, imageUrl: true, linkUrl: true },
  });
}
