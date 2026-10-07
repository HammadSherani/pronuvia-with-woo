"use server";

import { revalidatePath } from "next/cache";
import { prisma }         from "@/lib/db/prisma";
import { requireAdmin }   from "@/lib/auth/dal";
import { z }              from "zod";

const Schema = z.object({
  title:      z.string().min(1, "Title is required"),
  subtitle:   z.string().optional(),
  buttonText: z.string().optional(),
  imageUrl:   z.string().min(1, "Image is required"),
  linkUrl:    z.string().url("Must be a valid URL").or(z.literal("")).optional(),
  isPublished: z.boolean().default(false),
  sortOrder:  z.number().int().default(0),
});

export type WebsiteBannerActionState = {
  errors?: Record<string, string[]>;
  message?: string;
  success?: boolean;
} | undefined;

export async function createWebsiteBanner(
  _state: WebsiteBannerActionState,
  formData: FormData
): Promise<WebsiteBannerActionState> {
  await requireAdmin();

  const validated = Schema.safeParse({
    title:       formData.get("title") as string,
    subtitle:    (formData.get("subtitle") as string) || undefined,
    buttonText:  (formData.get("buttonText") as string) || undefined,
    imageUrl:    formData.get("imageUrl") as string,
    linkUrl:     (formData.get("linkUrl") as string) || "",
    isPublished: formData.get("isPublished") === "true",
    sortOrder:   Number(formData.get("sortOrder") ?? 0),
  });

  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors };
  }

  await prisma.websiteBanner.create({
    data: {
      title:       validated.data.title,
      subtitle:    validated.data.subtitle ?? null,
      buttonText:  validated.data.buttonText ?? null,
      imageUrl:    validated.data.imageUrl,
      linkUrl:     validated.data.linkUrl || null,
      isPublished: validated.data.isPublished,
      sortOrder:   validated.data.sortOrder,
    },
  });

  revalidatePath("/admin/website-banners");
  return { success: true, message: "Banner created successfully." };
}

export async function updateWebsiteBanner(
  id: string,
  _state: WebsiteBannerActionState,
  formData: FormData
): Promise<WebsiteBannerActionState> {
  await requireAdmin();

  const validated = Schema.safeParse({
    title:       formData.get("title") as string,
    subtitle:    (formData.get("subtitle") as string) || undefined,
    buttonText:  (formData.get("buttonText") as string) || undefined,
    imageUrl:    formData.get("imageUrl") as string,
    linkUrl:     (formData.get("linkUrl") as string) || "",
    isPublished: formData.get("isPublished") === "true",
    sortOrder:   Number(formData.get("sortOrder") ?? 0),
  });

  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors };
  }

  await prisma.websiteBanner.update({
    where: { id },
    data: {
      title:       validated.data.title,
      subtitle:    validated.data.subtitle ?? null,
      buttonText:  validated.data.buttonText ?? null,
      imageUrl:    validated.data.imageUrl,
      linkUrl:     validated.data.linkUrl || null,
      isPublished: validated.data.isPublished,
      sortOrder:   validated.data.sortOrder,
    },
  });

  revalidatePath("/admin/website-banners");
  return { success: true, message: "Banner updated successfully." };
}

export async function deleteWebsiteBanner(id: string): Promise<WebsiteBannerActionState> {
  await requireAdmin();
  await prisma.websiteBanner.delete({ where: { id } });
  revalidatePath("/admin/website-banners");
  return { success: true };
}

export async function toggleWebsiteBannerPublished(id: string, isPublished: boolean): Promise<void> {
  await requireAdmin();
  await prisma.websiteBanner.update({ where: { id }, data: { isPublished } });
  revalidatePath("/admin/website-banners");
}
