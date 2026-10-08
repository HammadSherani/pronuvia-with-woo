import "server-only";
import { getShopCategories, getShopProducts } from "./catalog";

// Shop listing data, or null when WooCommerce can't be reached — pages render
// a "temporarily unavailable" notice instead of crashing.
export async function loadShop() {
  try {
    const [products, categories] = await Promise.all([getShopProducts(), getShopCategories()]);
    return { products, categories };
  } catch (e) {
    console.error("[shop] WooCommerce catalog failed:", e);
    return null;
  }
}
