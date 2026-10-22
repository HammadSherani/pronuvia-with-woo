// Deep links into the WordPress admin, where the catalog is managed now.
// They go through /api/woo/sso, which signs the Pronuvia admin into WP admin
// first (no second password), then opens the page.

/** A path inside WP admin only, so the sign-in link can't be sent elsewhere. */
export function isWpAdminPath(p: string): boolean {
  return /^\/wp-admin\/[\w\-./?=&%]*$/.test(p) && !p.includes("..") && !p.includes("//");
}

const sso = (path: string) => `/api/woo/sso?to=${encodeURIComponent(`/wp-admin/${path}`)}`;

export const wpAdmin = {
  dashboard:   () => sso(""),
  products:    () => sso("edit.php?post_type=product"),
  newProduct:  () => sso("post-new.php?post_type=product"),
  editProduct: (wooId: string | number) => sso(`post.php?post=${wooId}&action=edit`),
  categories:  () => sso("edit-tags.php?taxonomy=product_cat&post_type=product"),
  shipping:    () => sso("admin.php?page=wc-settings&tab=shipping"),
  coupons:     () => sso("edit.php?post_type=shop_coupon"),
  // High-performance order storage (HPOS) is on
  editOrder:   (wooId: number) => sso(`admin.php?page=wc-orders&action=edit&id=${wooId}`),
};
