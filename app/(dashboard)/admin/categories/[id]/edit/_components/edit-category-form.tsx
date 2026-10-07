"use client";

import { useActionState } from "react";
import { updateCategory } from "@/actions/admin/categories";
import { FormField, FormActions } from "@/components/admin/form-field";

interface Props {
  id: string;
  defaultName: string;
  defaultDescription?: string | null;
}

export function EditCategoryForm({ id, defaultName, defaultDescription }: Props) {
  const boundAction = updateCategory.bind(null, id);
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

      <FormField label="Category Name" name="name" required defaultValue={defaultName} placeholder="e.g. Supplements" error={state?.errors?.name?.[0]} />
      <FormField label="Description" name="description" placeholder="Optional description">
        <textarea
          name="description"
          rows={3}
          defaultValue={defaultDescription ?? ""}
          placeholder="Optional description"
          className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:border-[#3DBFA4] focus:ring-1 focus:ring-[#3DBFA4] transition bg-white resize-none"
        />
      </FormField>

      <FormActions backHref="/admin/categories" submitLabel="Save Changes" pending={pending} />
    </form>
  );
}
