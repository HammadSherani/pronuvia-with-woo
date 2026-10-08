"use server";

import { getProductsForValidation, type ShopVariant } from "@/lib/woo/catalog";

type CartItem = { productId: string; title: string; variantSize: string; quantity?: number; [k: string]: unknown };

const STATUS_LABEL: Record<string, string> = {
  out_of_stock: "out of stock",
  discontinued: "discontinued",
  inactive:     "no longer available",
};

// Checks every cart line against the live WooCommerce catalog right before an
// order is placed: the product must still be published, the size must exist
// and be in stock, and tracked stock must cover the quantity.
export async function validateCartItemsAvailability(
  items: CartItem[],
): Promise<{ valid: true } | { valid: false; message: string }> {
  let products: Awaited<ReturnType<typeof getProductsForValidation>>;
  try {
    products = await getProductsForValidation(items.map((i) => i.productId));
  } catch (e) {
    console.error("[validate-items] WooCommerce lookup failed:", e);
    return { valid: false, message: "Could not verify product availability. Please try again in a moment." };
  }

  // The same size can appear on several lines; check stock against the total
  const qtyByLine = new Map<string, number>();
  for (const item of items) {
    const key = `${item.productId}::${item.variantSize}`;
    qtyByLine.set(key, (qtyByLine.get(key) ?? 0) + (item.quantity ?? 1));
  }

  for (const item of items) {
    const product = products.get(item.productId);
    if (!product) {
      return { valid: false, message: `"${item.title}" is no longer available.` };
    }

    if (!product.variants.length) {
      return { valid: false, message: `"${item.title}" is not available for purchase.` };
    }

    const variant: ShopVariant | undefined = item.variantSize
      ? product.variants.find((v) => v.size === item.variantSize)
      : product.variants[0];
    const size = item.variantSize ? ` (${item.variantSize})` : "";

    if (!variant) {
      return { valid: false, message: `Size "${item.variantSize}" of "${item.title}" no longer exists.` };
    }

    if (variant.status !== "in_stock") {
      const label = STATUS_LABEL[variant.status] ?? "unavailable";
      return { valid: false, message: `"${item.title}"${size} is ${label} and cannot be ordered.` };
    }

    const wanted = qtyByLine.get(`${item.productId}::${item.variantSize}`) ?? 1;
    if (variant.stock !== undefined && wanted > variant.stock) {
      return {
        valid:   false,
        message: `Only ${variant.stock} of "${item.title}"${size} left in stock — please lower the quantity.`,
      };
    }
  }

  return { valid: true };
}
