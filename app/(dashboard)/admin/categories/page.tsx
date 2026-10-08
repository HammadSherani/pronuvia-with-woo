import { requireAdmin } from "@/lib/auth/dal";
import { WooCategoriesPage } from "@/components/admin/woo-categories-page";

export const metadata = { title: "Categories – Pronuvia Admin" };

export default async function CategoriesPage() {
  await requireAdmin();
  return <WooCategoriesPage level="top" />;
}
