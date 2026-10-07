"use client";

import { useActionState, useState, useEffect } from "react";
import { useRouter }       from "next/navigation";
import dynamic             from "next/dynamic";
import toast               from "react-hot-toast";
import { ImageUpload }     from "@/components/admin/image-upload";
import type { BlogActionState } from "@/actions/admin/blogs";

const RichTextEditor = dynamic(
  () => import("@/components/admin/rich-text-editor").then((m) => m.RichTextEditor),
  { ssr: false, loading: () => <div className="h-48 border border-gray-200 rounded-lg bg-gray-50 animate-pulse" /> }
);

interface Props {
  action: (state: BlogActionState, formData: FormData) => Promise<BlogActionState>;
  defaultValues?: {
    title?:       string;
    slug?:        string;
    excerpt?:     string;
    content?:     string;
    imageUrl?:    string;
    isPublished?: boolean;
  };
}

function toSlug(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function BlogForm({ action, defaultValues }: Props) {
  const router = useRouter();
  const [imageUrl,    setImageUrl]    = useState(defaultValues?.imageUrl    ?? "");
  const [isPublished, setIsPublished] = useState(defaultValues?.isPublished ?? false);
  const [slug,        setSlug]        = useState(defaultValues?.slug        ?? "");
  const [slugTouched, setSlugTouched] = useState(!!defaultValues?.slug);
  const [content,     setContent]     = useState(defaultValues?.content     ?? "");

  const [state, formAction, pending] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.message ?? "Saved");
      router.push("/admin/blogs");
    } else if (state?.message && !state.success) {
      toast.error(state.message);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="imageUrl"    value={imageUrl} />
      <input type="hidden" name="isPublished" value={isPublished ? "true" : "false"} />
      <input type="hidden" name="slug"        value={slug} />
      <input type="hidden" name="content"     value={content} />

      {/* Cover Image */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Cover Image</label>
        <ImageUpload name="__imageUrl" value={imageUrl} onChange={setImageUrl} />
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
        <input
          name="title"
          defaultValue={defaultValues?.title}
          placeholder="e.g. SAC® Formula: A Breakthrough in Bone Health"
          onChange={(e) => {
            if (!slugTouched) setSlug(toSlug(e.target.value));
          }}
          className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/30 focus:border-gray-900"
        />
        {state?.errors?.title && <p className="text-xs text-red-500 mt-1">{state.errors.title[0]}</p>}
      </div>

      {/* Slug */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Slug</label>
        <input
          value={slug}
          onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
          placeholder="e.g. sac-formula-bone-health"
          className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 font-mono placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/30 focus:border-gray-900"
        />
        {state?.errors?.slug && <p className="text-xs text-red-500 mt-1">{state.errors.slug[0]}</p>}
        <p className="text-xs text-gray-400 mt-1">Auto-generated from title. Used in the URL.</p>
      </div>

      {/* Excerpt */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Excerpt <span className="text-gray-400 font-normal">(optional — shown on blog cards)</span>
        </label>
        <textarea
          name="excerpt"
          defaultValue={defaultValues?.excerpt}
          rows={3}
          placeholder="Short summary shown on the blog listing..."
          className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/30 focus:border-gray-900 resize-none"
        />
      </div>

      {/* Content */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Content <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <RichTextEditor value={content} onChange={setContent} />
      </div>

      {/* Published */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setIsPublished((p) => !p)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isPublished ? "bg-gray-900" : "bg-gray-200"}`}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isPublished ? "translate-x-6" : "translate-x-1"}`} />
        </button>
        <span className="text-sm text-gray-700">
          {isPublished ? "Published — visible on website" : "Draft — hidden from website"}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={pending}
          className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {pending ? "Saving…" : "Save Post"}
        </button>
        <button type="button" onClick={() => router.push("/admin/blogs")}
          className="px-5 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}
