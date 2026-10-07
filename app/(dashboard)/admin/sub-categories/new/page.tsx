import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { FormCard } from "@/components/admin/form-card";
import { SubCategoryForm } from "./_components/sub-category-form";

export const metadata = { title: "Add Sub-Category – Pronuvia Admin" };

export default async function NewSubCategoryPage() {
  await requireAdmin();

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (categories.length === 0) {
    redirect("/admin/categories/new");
  }

  return (
    <FormCard title="Add New Sub-Category" backHref="/admin/sub-categories">
      <SubCategoryForm categories={categories} />
    </FormCard>
  );
}
