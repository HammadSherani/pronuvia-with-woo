"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { cloudinary } from "@/lib/cloudinary";

export type CatalogActionState = {
  message?: string;
  success?: boolean;
} | undefined;

export async function saveDocument(opts: {
  fileName: string;
  fileUrl: string;
  fileSize: number;
}): Promise<CatalogActionState> {
  const session = await requireAdmin();

  await prisma.catalogDocument.create({
    data: {
      fileName:   opts.fileName,
      fileUrl:    opts.fileUrl,
      fileSize:   opts.fileSize,
      uploadedBy: session.userId,
    },
  });

  revalidatePath("/admin/downloads");
  return { success: true, message: `"${opts.fileName}" uploaded successfully.` };
}

export async function deleteDocument(id: string): Promise<CatalogActionState> {
  await requireAdmin();

  const doc = await prisma.catalogDocument.findUnique({ where: { id } });
  if (!doc) return { message: "Document not found." };

  // Delete from Cloudinary
  try {
    const match = doc.fileUrl.match(/\/upload\/(?:v\d+\/)?(.+)$/);
    if (match) {
      await cloudinary.uploader.destroy(match[1], { resource_type: "raw" });
    }
  } catch {
    // Continue even if Cloudinary delete fails — remove DB record regardless
  }

  await prisma.catalogDocument.delete({ where: { id } });

  revalidatePath("/admin/downloads");
  revalidatePath("/sales/downloads");
  revalidatePath("/physician/downloads");
  return { success: true, message: `"${doc.fileName}" deleted.` };
}

export async function listDocuments() {
  return prisma.catalogDocument.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, fileName: true, fileUrl: true, fileSize: true, createdAt: true },
  });
}
