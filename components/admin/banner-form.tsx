"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import toast from "react-hot-toast";
import { ImageUpload } from "@/components/admin/image-upload";
import type { BannerActionState } from "@/actions/admin/banners";

interface BannerFormProps {
  action: (state: BannerActionState, formData: FormData) => Promise<BannerActionState>;
  defaultValues?: {
    title?: string;
    imageUrl?: string;
    linkUrl?: string;
    isPublished?: boolean;
    sortOrder?: number;
  };
}

export function BannerForm({ action, defaultValues }: BannerFormProps) {
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState(defaultValues?.imageUrl ?? "");
  const [isPublished, setIsPublished] = useState(defaultValues?.isPublished ?? false);

  const [state, formAction, pending] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.message ?? "Saved");
      router.push("/admin/banners");
    } else if (state?.message && !state.success) {
      toast.error(state.message);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-6">
      {/* Hidden fields for controlled values */}
      <input type="hidden" name="imageUrl" value={imageUrl} />
      <input type="hidden" name="isPublished" value={isPublished ? "true" : "false"} />

      {/* Banner Image */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Banner Image</label>
        <ImageUpload name="__imageUrl" value={imageUrl} onChange={setImageUrl} />
        {state?.errors?.imageUrl && (
          <p className="text-xs text-red-500 mt-1">{state.errors.imageUrl[0]}</p>
        )}
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
        <input
          name="title"
          defaultValue={defaultValues?.title}
          placeholder="e.g. Summer Promotion"
          className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/30 focus:border-gray-900"
        />
        {state?.errors?.title && (
          <p className="text-xs text-red-500 mt-1">{state.errors.title[0]}</p>
        )}
      </div>

      {/* Link URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Link URL <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          name="linkUrl"
          defaultValue={defaultValues?.linkUrl ?? ""}
          placeholder="https://example.com"
          className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/30 focus:border-gray-900"
        />
        {state?.errors?.linkUrl && (
          <p className="text-xs text-red-500 mt-1">{state.errors.linkUrl[0]}</p>
        )}
      </div>

      {/* Sort Order */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Sort Order</label>
        <input
          name="sortOrder"
          type="number"
          defaultValue={defaultValues?.sortOrder ?? 0}
          min={0}
          className="w-32 border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/30 focus:border-gray-900"
        />
        <p className="text-xs text-gray-400 mt-1">Lower numbers appear first</p>
      </div>

      {/* Published Toggle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsPublished((p) => !p)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            isPublished ? "bg-gray-900" : "bg-gray-200"
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            isPublished ? "translate-x-6" : "translate-x-1"
          }`} />
        </button>
        <span className="text-sm text-gray-700">
          {isPublished ? "Published — visible to users" : "Draft — hidden from users"}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending || !imageUrl}
          className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {pending ? "Saving…" : "Save Banner"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/banners")}
          className="px-5 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
