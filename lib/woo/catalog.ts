import "server-only";
import { wooFetch } from "./client";
import type { WooCategory, WooProduct, WooVariation } from "./types";

// Read side of the catalog. WooCommerce is the source of truth; everything is
// mapped into the product/variant shapes the shop UI already uses.

export const CATALOG_TAG = "woo-catalog";
const SHOP_CACHE = { revalidate: 60, tags: [CATALOG_TAG] };

// Size label for simple (non-variable) products, which have no Size attribute
export const SINGLE_SIZE_LABEL = "Standard";

export type VariantStatus = "in_stock" | "out_of_stock" | "discontinued" | "inactive";

export type ShopVariant = {
  variationId: number | null;      // null for a simple product's single "variant"
  size:        string;
  sku:         string;
  salePrice:   number;
  stock?:      number;
  status:      VariantStatus;
  isDefault:   boolean;
  image?:      string;
};

export type CategoryRef = { id: string; name: string };

export type ShopProduct = {
  id:             string;          // Woo product id
  title:          string;
  slug:           string;
  sku:            string;
  description:    string | null;
  image:          string | null;
  imageGallery:   string[];
  salePrice:      number;          // lowest price among purchasable sizes
  compareAtPrice: number | null;
  variants:       ShopVariant[];
  tags:           string[];
  category:       CategoryRef | null;
  subCategory:    CategoryRef | null;
  status:         "ACTIVE";
};

export type AdminProduct = Omit<ShopProduct, "status"> & {
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  stock:  number | null;           // sum of tracked stock, null when not tracked
};

// ── Fetch helpers ─────────────────────────────────────────────────────────────

type Freshness = "cached" | "fresh";

async function fetchAllPages<T>(path: string, query: Record<string, string | number>, freshness: Freshness) {
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const { data, headers } = await wooFetch<T[]>(path, {
      query:    { per_page: 100, page, ...query },
      cacheFor: freshness === "cached" ? SHOP_CACHE : undefined,
    });
    items.push(...data);
    const totalPages = Number(headers.get("x-wp-totalpages") ?? 1);
    if (page >= totalPages || data.length === 0) return items;
  }
}

// Run async work with a small concurrency limit (keeps the WP host happy)
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

// ── Mapping ───────────────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#039;": "'", "&#8217;": "’",
  "&#8216;": "‘", "&#8220;": "“", "&#8221;": "”", "&#8211;": "–", "&nbsp;": " ",
};

function htmlToText(html: string): string | null {
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&[#a-z0-9]+;/gi, (e) => ENTITIES[e] ?? e)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || null;
}

const toNumber = (s: string) => (s === "" ? 0 : Number(s));

const metaValue = (meta: { key: string; value: unknown }[], key: string) =>
  meta.find((m) => m.key === key)?.value;

// Woo has no "discontinued" stock state, so it is kept as variation meta
// (_pronuvia_status = "discontinued"); a disabled (private) variation is hidden.
function variationStatus(v: WooVariation): VariantStatus {
  if (v.status !== "publish") return "inactive";
  if (metaValue(v.meta_data, "_pronuvia_status") === "discontinued") return "discontinued";
  return v.stock_status === "outofstock" ? "out_of_stock" : "in_stock";
}

function mapVariation(v: WooVariation, defaultSize: string | undefined): ShopVariant {
  const sizeAttr = v.attributes.find((a) => a.name.toLowerCase() === "size") ?? v.attributes[0];
  const size = sizeAttr?.option ?? "";
  return {
    variationId: v.id,
    size,
    sku:         v.sku,
    salePrice:   toNumber(v.price),
    stock:       v.manage_stock === true && v.stock_quantity !== null ? v.stock_quantity : undefined,
    status:      variationStatus(v),
    isDefault:   defaultSize !== undefined && defaultSize === size,
    image:       v.image?.src || undefined,
  };
}

function simpleVariant(p: WooProduct): ShopVariant {
  return {
    variationId: null,
    size:        SINGLE_SIZE_LABEL,
    sku:         p.sku,
    salePrice:   toNumber(p.price),
    stock:       p.manage_stock && p.stock_quantity !== null ? p.stock_quantity : undefined,
    status:      p.stock_status === "outofstock" ? "out_of_stock" : "in_stock",
    isDefault:   true,
  };
}

async function getVariants(p: WooProduct, freshness: Freshness): Promise<ShopVariant[]> {
  if (p.type !== "variable") return [simpleVariant(p)];
  if (p.variations.length === 0) return [];
  const defaultSize = p.default_attributes.find((a) => a.name.toLowerCase() === "size")?.option;
  const variations = await fetchAllPages<WooVariation>(
    `wc/v3/products/${p.id}/variations`, { status: "any" }, freshness,
  );
  return variations
    .sort((a, b) => a.menu_order - b.menu_order || a.id - b.id)
    .map((v) => mapVariation(v, defaultSize))
    .filter((v) => v.size);
}

async function getCategoryParents(freshness: Freshness) {
  const categories = await fetchAllPages<WooCategory>("wc/v3/products/categories", { hide_empty: "false" }, freshness);
  return new Map(categories.map((c) => [c.id, c.parent]));
}

function mapProduct(p: WooProduct, variants: ShopVariant[], parents: Map<number, number>): ShopProduct {
  const purchasable = variants.filter((v) => v.status === "in_stock");
  const prices = (purchasable.length ? purchasable : variants).map((v) => v.salePrice);
  const price  = prices.length ? Math.min(...prices) : toNumber(p.price);
  const regular = toNumber(p.regular_price);

  const top = p.categories.find((c) => (parents.get(c.id) ?? 0) === 0) ?? null;
  const sub = p.categories.find((c) => (parents.get(c.id) ?? 0) !== 0) ?? null;

  return {
    id:             String(p.id),
    title:          p.name,
    slug:           p.slug,
    sku:            p.sku,
    description:    htmlToText(p.description) ?? htmlToText(p.short_description),
    image:          p.images[0]?.src ?? null,
    imageGallery:   p.images.slice(1).map((i) => i.src),
    salePrice:      price,
    compareAtPrice: p.type === "simple" && regular > price ? regular : null,
    variants,
    tags:           p.tags.map((t) => t.name),
    category:       top ? { id: String(top.id), name: top.name } : null,
    subCategory:    sub ? { id: String(sub.id), name: sub.name } : null,
    status:         "ACTIVE",
  };
}

async function hydrate(products: WooProduct[], freshness: Freshness): Promise<ShopProduct[]> {
  const [parents, variantLists] = await Promise.all([
    getCategoryParents(freshness),
    mapLimit(products, 4, (p) => getVariants(p, freshness)),
  ]);
  return products.map((p, i) => mapProduct(p, variantLists[i], parents));
}

// ── Shop (cached 60s) ─────────────────────────────────────────────────────────

export async function getShopProducts(): Promise<ShopProduct[]> {
  const products = await fetchAllPages<WooProduct>(
    "wc/v3/products", { status: "publish", orderby: "date", order: "desc" }, "cached",
  );
  return hydrate(products, "cached");
}

export async function getShopCategories(): Promise<CategoryRef[]> {
  const categories = await fetchAllPages<WooCategory>(
    "wc/v3/products/categories", { hide_empty: "true" }, "cached",
  );
  return categories
    .filter((c) => c.parent === 0 && c.slug !== "uncategorized")
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ id: String(c.id), name: c.name }));
}

export async function getShopProductBySlug(slug: string) {
  const { data } = await wooFetch<WooProduct[]>("wc/v3/products", {
    query:    { slug, status: "publish" },
    cacheFor: SHOP_CACHE,
  });
  if (!data[0]) return null;

  const [product] = await hydrate([data[0]], "cached");

  let related: ShopProduct[] = [];
  if (product.category) {
    const { data: rel } = await wooFetch<WooProduct[]>("wc/v3/products", {
      query:    { category: product.category.id, status: "publish", exclude: product.id, per_page: 4 },
      cacheFor: SHOP_CACHE,
    });
    related = await hydrate(rel, "cached");
  }

  return { product, related };
}

// ── Checkout validation (always fresh) ───────────────────────────────────────

// Current state of the given products, for validating a cart right before an
// order is placed. Products that no longer exist or aren't published are absent.
export async function getProductsForValidation(ids: string[]): Promise<Map<string, ShopProduct>> {
  const numeric = [...new Set(ids)].filter((id) => /^\d+$/.test(id));
  if (!numeric.length) return new Map();
  const products = await fetchAllPages<WooProduct>(
    "wc/v3/products", { include: numeric.join(","), status: "publish" }, "fresh",
  );
  const hydrated = await hydrate(products, "fresh");
  return new Map(hydrated.map((p) => [p.id, p]));
}

// ── Admin (always fresh, all statuses) ────────────────────────────────────────

const ADMIN_STATUS: Record<WooProduct["status"], AdminProduct["status"]> = {
  publish: "ACTIVE", draft: "DRAFT", pending: "DRAFT", private: "ARCHIVED",
};

export async function getAdminProducts(): Promise<AdminProduct[]> {
  const products = await fetchAllPages<WooProduct>(
    "wc/v3/products", { status: "any", orderby: "date", order: "desc" }, "fresh",
  );
  const shop = await hydrate(products, "fresh");
  return shop.map((s, i) => {
    const tracked = s.variants.filter((v) => v.stock !== undefined);
    return {
      ...s,
      status: ADMIN_STATUS[products[i].status],
      stock:  tracked.length ? tracked.reduce((n, v) => n + (v.stock ?? 0), 0) : null,
    };
  });
}

export type AdminCategory = { id: string; name: string; slug: string; count: number; parent: CategoryRef | null };

export async function getAdminCategories(): Promise<AdminCategory[]> {
  const categories = await fetchAllPages<WooCategory>(
    "wc/v3/products/categories", { hide_empty: "false" }, "fresh",
  );
  const byId = new Map(categories.map((c) => [c.id, c]));
  return categories
    .filter((c) => c.slug !== "uncategorized")
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => {
      const parent = c.parent ? byId.get(c.parent) : undefined;
      return {
        id: String(c.id), name: c.name, slug: c.slug, count: c.count,
        parent: parent ? { id: String(parent.id), name: parent.name } : null,
      };
    });
}
