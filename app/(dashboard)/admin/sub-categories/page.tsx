import { requireAdmin } from "@/lib/auth/dal";
import { WooCategoriesPage } from "@/components/admin/woo-categories-page";

export const metadata = { title: "Sub-Categories – Pronuvia Admin" };

export default async function SubCategoriesPage() {
  await requireAdmin();
  return <WooCategoriesPage level="sub" />;
}
