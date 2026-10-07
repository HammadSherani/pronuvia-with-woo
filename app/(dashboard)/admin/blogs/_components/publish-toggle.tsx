"use client";

import { useTransition } from "react";
import { toggleBlogPublished } from "@/actions/admin/blogs";

export function BlogPublishToggle({ id, isPublished }: { id: string; isPublished: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button type="button" disabled={pending}
      onClick={() => startTransition(() => toggleBlogPublished(id, !isPublished))}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
        isPublished ? "bg-gray-900" : "bg-gray-200"
      }`}>
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
        isPublished ? "translate-x-[18px]" : "translate-x-1"
      }`} />
    </button>
  );
}
