"use server";

import { prisma } from "@/lib/db/prisma";

type CartItem = { productId: string; title: string; variantSize: string; [k: string]: unknown };
type Variant  = { size?: string; status?: string; [k: string]: unknown };

const STATUS_LABEL: Record<string, string> = {
  out_of_stock: "out of stock",
  discontinued: "discontinued",
  inactive:     "no longer available",
};

export async function validateCartItemsAvailability(
  items: CartItem[],
): Promise<{ valid: true } | { valid: false; message: string }> {
  const productIds = [...new Set(items.map((i) => i.productId))];

  const products = await prisma.product.findMany({
    where:  { id: { in: productIds } },
    select: { id: true, title: true, variants: true },
  });

  const byId = new Map(products.map((p) => [p.id, p]));

  for (const item of items) {
    const product = byId.get(item.productId);
    if (!product) {
      return { valid: false, message: `"${item.title}" is no longer available.` };
    }

    const variants = product.variants as Variant[];

    // Products with no variants (edge case) — skip size check
    if (!variants.length) continue;

    const variant = item.variantSize
      ? variants.find((v) => (v.size ?? "") === item.variantSize)
      : variants[0];

    if (!variant) {
      return { valid: false, message: `Size "${item.variantSize}" of "${item.title}" no longer exists.` };
    }

    const status = variant.status ?? "in_stock";
    if (status !== "in_stock") {
      const label = STATUS_LABEL[status] ?? "unavailable";
      const size  = item.variantSize ? ` (${item.variantSize})` : "";
      return {
        valid:   false,
        message: `"${item.title}"${size} is ${label} and cannot be ordered.`,
      };
    }
  }

  return { valid: true };
}
