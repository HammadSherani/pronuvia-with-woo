import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { FormCard } from "@/components/admin/form-card";
import { getSubCategoryById } from "@/actions/admin/sub-categories";
import { EditSubCategoryForm } from "./_components/edit-sub-category-form";

export const metadata = { title: "Edit Sub-Category – Pronuvia Admin" };

type Props = { params: Promise<{ id: string }> };

export default async function EditSubCategoryPage({ params }: Props) {
  await requireAdmin();

  const { id } = await params;
  const subCategory = await getSubCategoryById(id);
  if (!subCategory) notFound();

  const categories = await prisma.category.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <FormCard title="Edit Sub-Category" backHref="/admin/sub-categories">
      <EditSubCategoryForm
        id={subCategory.id}
        defaultName={subCategory.name}
        defaultDescription={subCategory.description}
        defaultCategoryId={subCategory.categoryId}
        categories={categories}
      />
    </FormCard>
  );
}
