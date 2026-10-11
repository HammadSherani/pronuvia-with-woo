import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { wpAdmin } from "@/lib/woo/admin-links";

// Shipping rates are WooCommerce shipping zones now
export default async function Page() {
  await requireAdmin();
  redirect(wpAdmin.shipping());
}
