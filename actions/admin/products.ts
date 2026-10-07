"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { toSlug } from "@/lib/utils/slug";
import { ProductStatus } from "@/generated/prisma/enums";

const SizeSchema = z.object({
  size:      z.string().min(1),
  sku:       z.string().optional(),
  gtin:      z.string().optional(),
  image:     z.string().optional(),
  costPrice: z.number().min(0).optional(),
  salePrice: z.number().min(0).optional(),
  stock:     z.number().int().min(0).optional(),
  weight:    z.number().min(0).optional(),
  status:    z.enum(["in_stock", "out_of_stock", "discontinued", "inactive"]).default("in_stock"),
  // Which variant the storefront pre-selects on the product card / detail
  // page. Kept on the variant object itself (rather than a top-level index)
  // so it stays attached to the right variant even after the storefront
  // re-sorts the array by size.
  isDefault: z.boolean().optional().default(false),
});

const ProductSchema = z.object({
  title:        z.string().min(1, "Title is required").trim(),
  description:  z.string().optional(),
  image:        z.string().optional(),
  imageGallery: z.array(z.string()).optional().default([]),
  tags:         z.array(z.string()).optional().default([]),
  variants:     z.array(SizeSchema).min(1, "At least one size variant is required"),
  status:       z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("ACTIVE"),
  categoryId:   z.string().min(1, "Category is required"),
  subCategoryId: z.string().optional(),
});

export type ProductActionState = {
  errors?: Record<string, string[]>;
  message?: string;
  success?: boolean;
} | undefined;

function num(formData: FormData, key: string): number | undefined {
  const raw = (formData.get(key) as string | null)?.trim();
  if (!raw) return undefined;
  const n = Number(raw);
  return isNaN(n) ? undefined : n;
}

function parseProductFormData(formData: FormData) {
  const gallery = formData.getAll("imageGallery[]").map(String).filter(Boolean);
  const tags    = (formData.get("tags") as string ?? "")
    .split(",").map((t) => t.trim()).filter(Boolean);

  const sizeNames      = formData.getAll("sizeName[]").map(String);
  const sizeSkus       = formData.getAll("sizeSku[]").map(String);
  const sizeGtins      = formData.getAll("sizeGtin[]").map(String);
  const sizeImages     = formData.getAll("sizeImage[]").map(String);
  const sizeCostPrices = formData.getAll("sizeCostPrice[]").map(String);
  const sizeSalePrices = formData.getAll("sizeSalePrice[]").map(String);
  const sizeStocks     = formData.getAll("sizeStock[]").map(String);
  const sizeWeights    = formData.getAll("sizeWeight[]").map(String);
  const sizeStatuses   = formData.getAll("sizeStatus[]").map(String);
  const sizeIsDefaults = formData.getAll("sizeIsDefault[]").map(String);

  const toNum = (s: string) => { const n = Number(s.trim()); return isNaN(n) || s.trim() === "" ? undefined : n; };

  const variants = sizeNames
    .map((size, i) => ({
      size:      size.trim(),
      sku:       sizeSkus[i]?.trim()   || undefined,
      gtin:      sizeGtins[i]?.trim()  || undefined,
      image:     sizeImages[i]?.trim() || undefined,
      costPrice: toNum(sizeCostPrices[i] ?? ""),
      salePrice: toNum(sizeSalePrices[i] ?? ""),
      stock:     toNum(sizeStocks[i]    ?? ""),
      weight:    toNum(sizeWeights[i]   ?? ""),
      status:    (sizeStatuses[i]?.trim() || "in_stock") as "in_stock" | "out_of_stock" | "discontinued" | "inactive",
      isDefault: sizeIsDefaults[i] === "1",
    }))
    .filter((v) => v.size);

  // Guarantee exactly one default variant — fall back to the first row if
  // none was explicitly flagged (legacy data, or a stripped hidden field).
  if (variants.length && !variants.some((v) => v.isDefault)) {
    variants[0].isDefault = true;
  }

  return {
    title:        (formData.get("title") as string)?.trim() || "",
    description:  (formData.get("description") as string)  || undefined,
    image:        (formData.get("image") as string)         || undefined,
    imageGallery: gallery,
    tags,
    variants,
    status:       (formData.get("status") as string) || "ACTIVE",
    categoryId:   (formData.get("categoryId") as string)    || "",
    subCategoryId:(formData.get("subCategoryId") as string) || undefined,
  };
}

function deriveProductFields(variants: { sku?: string; salePrice?: number; costPrice?: number; stock?: number; isDefault?: boolean }[]) {
  const salePrices = variants.map((v) => v.salePrice ?? 0).filter((p) => p > 0);
  const costPrices = variants.map((v) => v.costPrice ?? 0).filter((p) => p > 0);
  const defaultVariant = variants.find((v) => v.isDefault) ?? variants[0];
  return {
    sku:       defaultVariant?.sku?.trim() || `PRN-${Date.now().toString(36).toUpperCase()}`,
    salePrice: salePrices.length ? Math.min(...salePrices) : 0,
    costPrice: costPrices.length ? Math.min(...costPrices) : 0,
    quantity:  variants.reduce((s, v) => s + (v.stock ?? 0), 0),
    discount:  0,
    compareAtPrice: null,
    gtin:      null,
    weight:    null,
    weightUnit: "kg",
  };
}

export async function createProduct(
  _state: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  await requireAdmin();

  const raw = parseProductFormData(formData);
  const validated = ProductSchema.safeParse(raw);

  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors };
  }

  const data    = validated.data;
  const slug    = toSlug(data.title);
  const derived = deriveProductFields(data.variants);

  const slugExists = await prisma.product.findUnique({ where: { slug } });
  if (slugExists) return { errors: { title: ["A product with this title already exists."] } };

  const skuExists = await prisma.product.findUnique({ where: { sku: derived.sku } });
  if (skuExists) {
    derived.sku = `${derived.sku}-${Date.now().toString(36)}`;
  }

  await prisma.product.create({
    data: {
      title:         data.title,
      description:   data.description,
      image:         data.image || null,
      imageGallery:  data.imageGallery ?? [],
      tags:          data.tags ?? [],
      variants:      data.variants,
      status:        data.status as ProductStatus,
      categoryId:    data.categoryId || null,
      subCategoryId: data.subCategoryId || null,
      slug,
      ...derived,
    },
  });

  revalidatePath("/admin/products");
  return { success: true, message: "Product created successfully." };
}

export async function updateProduct(
  id: string,
  _state: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  await requireAdmin();

  const raw = parseProductFormData(formData);
  const validated = ProductSchema.safeParse(raw);

  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors };
  }

  const data    = validated.data;
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return { message: "Product not found." };

  const slug    = toSlug(data.title);
  const derived = deriveProductFields(data.variants);

  if (slug !== existing.slug) {
    const taken = await prisma.product.findUnique({ where: { slug } });
    if (taken) return { errors: { title: ["A product with this title already exists."] } };
  }

  await prisma.product.update({
    where: { id },
    data: {
      title:         data.title,
      description:   data.description,
      image:         data.image || null,
      imageGallery:  data.imageGallery ?? [],
      tags:          data.tags ?? [],
      variants:      data.variants,
      status:        data.status as ProductStatus,
      categoryId:    data.categoryId || null,
      subCategoryId: data.subCategoryId || null,
      slug,
      ...derived,
      sku: existing.sku, // keep original SKU on update
    },
  });

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}/edit`);
  return { success: true, message: "Product updated successfully." };
}

export async function deleteProduct(id: string): Promise<ProductActionState> {
  await requireAdmin();
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return { message: "Product not found." };
  await prisma.product.delete({ where: { id } });
  revalidatePath("/admin/products");
  return { success: true };
}

export async function getProducts(opts?: { skip?: number; take?: number }) {
  await requireAdmin();
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      select: {
        id: true, title: true, image: true, salePrice: true,
        quantity: true, sku: true, status: true, variants: true,
        category: { select: { name: true } },
        subCategory: { select: { name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip: opts?.skip,
      take: opts?.take,
    }),
    prisma.product.count(),
  ]);
  return { products, total };
}

export async function getProductById(id: string) {
  await requireAdmin();
  return prisma.product.findUnique({
    where: { id },
    include: {
      category:    { select: { name: true } },
      subCategory: { select: { name: true } },
    },
  });
}

