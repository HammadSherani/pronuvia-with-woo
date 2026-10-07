"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { saveDocument } from "@/actions/admin/manage-catalog";
import { useRouter } from "next/navigation";

export function PdfUploader() {
  const [dragging, setDragging]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router   = useRouter();

  async function upload(file: File) {
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are allowed.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File exceeds the 20 MB limit.");
      return;
    }

    setUploading(true);
    setProgress(`Uploading ${file.name}…`);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/upload/catalog", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Upload failed");
      }

      const { url, fileName, fileSize } = await res.json();

      setProgress("Saving record…");
      const result = await saveDocument({ fileName, fileUrl: url, fileSize });

      if (result?.success) {
        toast.success(result.message ?? "Uploaded successfully");
        router.refresh();
      } else {
        toast.error(result?.message ?? "Failed to save");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setProgress("");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) upload(file);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => !uploading && inputRef.current?.click()}
      className={`
        relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200
        ${dragging  ? "border-gray-900 bg-gray-900/5 scale-[1.01]" : "border-gray-200 bg-gray-50/50 hover:border-gray-900/50 hover:bg-gray-900/3"}
        ${uploading ? "pointer-events-none opacity-70" : ""}
      `}
    >
      <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={onInputChange} />

      {uploading ? (
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-[3px] border-gray-900/30 border-t-[#3DBFA4] rounded-full animate-spin" />
          <p className="text-sm font-medium text-gray-600">{progress}</p>
        </div>
      ) : (
        <>
          {/* PDF icon */}
          <div className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors ${dragging ? "bg-gray-900/15" : "bg-gray-100"}`}>
            <svg className={`w-8 h-8 transition-colors ${dragging ? "text-[#3DBFA4]" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>

          <p className="text-base font-semibold text-gray-700 mb-1">
            {dragging ? "Drop your PDF here" : "Drag & drop a PDF here"}
          </p>
          <p className="text-sm text-gray-400 mb-4">or click to browse files</p>

          <div className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 shadow-sm">
            <svg className="w-4 h-4 text-[#3DBFA4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Choose PDF file
          </div>

          <p className="text-xs text-gray-400 mt-4">PDF only · max 20 MB</p>
        </>
      )}
    </div>
  );
}

export { fmtSize } from "@/lib/utils/format";
