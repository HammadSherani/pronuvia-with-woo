import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { wpAdmin } from "@/lib/woo/admin-links";

// Categories are managed in WooCommerce now
export default async function Page() {
  await requireAdmin();
  redirect(wpAdmin.categories());
}
