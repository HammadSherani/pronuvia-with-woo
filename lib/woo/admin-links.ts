import "server-only";

// Deep links into the WordPress admin, where the catalog is managed now.

function base() {
  return (process.env.WOO_URL ?? "").replace(/\/$/, "") + "/wp-admin";
}

export const wpAdmin = {
  products:    () => `${base()}/edit.php?post_type=product`,
  newProduct:  () => `${base()}/post-new.php?post_type=product`,
  editProduct: (wooId: string | number) => `${base()}/post.php?post=${wooId}&action=edit`,
  categories:  () => `${base()}/edit-tags.php?taxonomy=product_cat&post_type=product`,
  shipping:    () => `${base()}/admin.php?page=wc-settings&tab=shipping`,
  // High-performance order storage (HPOS) is on
  editOrder:   (wooId: number) => `${base()}/admin.php?page=wc-orders&action=edit&id=${wooId}`,
};
