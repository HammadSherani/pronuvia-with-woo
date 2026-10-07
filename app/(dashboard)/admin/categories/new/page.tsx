import { FormCard } from "@/components/admin/form-card";
import { CategoryForm } from "./_components/category-form";

export const metadata = { title: "Add Category – Pronuvia Admin" };

export default function NewCategoryPage() {
  return (
    <FormCard title="Add New Category" backHref="/admin/categories">
      <CategoryForm />
    </FormCard>
  );
}
