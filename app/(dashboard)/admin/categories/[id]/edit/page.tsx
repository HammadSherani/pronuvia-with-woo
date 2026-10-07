import { notFound } from "next/navigation";
import { FormCard } from "@/components/admin/form-card";
import { getCategoryById } from "@/actions/admin/categories";
import { EditCategoryForm } from "./_components/edit-category-form";

export const metadata = { title: "Edit Category – Pronuvia Admin" };

type Props = { params: Promise<{ id: string }> };

export default async function EditCategoryPage({ params }: Props) {
  const { id } = await params;
  const category = await getCategoryById(id);
  if (!category) notFound();

  return (
    <FormCard title="Edit Category" backHref="/admin/categories">
      <EditCategoryForm
        id={category.id}
        defaultName={category.name}
        defaultDescription={category.description}
      />
    </FormCard>
  );
}
