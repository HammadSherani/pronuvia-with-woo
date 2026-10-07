"use client";

import { useActionState } from "react";
import { updateSubCategory } from "@/actions/admin/sub-categories";
import { FormField, FormActions } from "@/components/admin/form-field";

interface Category { id: string; name: string }

interface Props {
  id: string;
  defaultName: string;
  defaultDescription?: string | null;
  defaultCategoryId: string;
  categories: Category[];
}

export function EditSubCategoryForm({ id, defaultName, defaultDescription, defaultCategoryId, categories }: Props) {
  const boundAction = updateSubCategory.bind(null, id);
  const [state, action, pending] = useActionState(boundAction, undefined);

  return (
    <form action={action}>
      {state?.message && !state.success && (
        <div className="mb-5 px-4 py-2.5 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
          {state.message}
        </div>
      )}
      {state?.success && (
        <div className="mb-5 px-4 py-2.5 bg-emerald-50 border border-emerald-100 rounded-lg text-sm text-emerald-700">
          {state.message}
        </div>
      )}

      <FormField label="Sub-Category Name" name="name" required defaultValue={defaultName} placeholder="e.g. Vitamins" error={state?.errors?.name?.[0]} />

      <FormField label="Parent Category" name="categoryId" required error={state?.errors?.categoryId?.[0]}>
        <select
          name="categoryId"
          defaultValue={defaultCategoryId}
          className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-700 outline-none focus:border-[#3DBFA4] focus:ring-1 focus:ring-[#3DBFA4] transition bg-white"
        >
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </FormField>

      <FormField label="Description" name="description" placeholder="Optional description">
        <textarea
          name="description"
          rows={3}
          defaultValue={defaultDescription ?? ""}
          placeholder="Optional description"
          className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:border-[#3DBFA4] focus:ring-1 focus:ring-[#3DBFA4] transition bg-white resize-none"
        />
      </FormField>

      <FormActions backHref="/admin/sub-categories" submitLabel="Save Changes" pending={pending} />
    </form>
  );
}
