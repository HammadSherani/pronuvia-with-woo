import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { wpAdmin } from "@/lib/woo/admin-links";

// Products are created in WooCommerce now
export default async function Page() {
  await requireAdmin();
  redirect(wpAdmin.newProduct());
}
