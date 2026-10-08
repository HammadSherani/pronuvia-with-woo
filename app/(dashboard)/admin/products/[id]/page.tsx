import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";

// Product details live in WooCommerce now — the list links straight there
export default async function Page() {
  await requireAdmin();
  redirect("/admin/products");
}
