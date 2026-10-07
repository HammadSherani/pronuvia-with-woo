"use client";

import { useRef, useState } from "react";

interface ImageUploadProps {
  name: string;
  value: string;
  onChange: (url: string) => void;
  compact?: boolean;
}

export function ImageUpload({ name, value, onChange, compact = false }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json() as { url?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      onChange(json.url!);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const boxCls = compact
    ? "w-[64px] h-[64px] rounded-lg"
    : "w-full h-36 rounded-xl";

  return (
    <div className={compact ? "w-[64px] shrink-0" : "w-full"}>
      <input type="hidden" name={name} value={value} />

      {value ? (
        <div className={`relative ${boxCls} overflow-hidden border border-gray-200 group`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
            <button type="button" onClick={() => fileRef.current?.click()}
              className="bg-white text-gray-700 rounded text-[10px] font-medium px-1.5 py-0.5 hover:bg-gray-100 cursor-pointer">
              Change
            </button>
            <button type="button" onClick={() => onChange("")}
              className="bg-white text-red-500 rounded text-[10px] font-medium px-1.5 py-0.5 hover:bg-gray-100 cursor-pointer">
              ✕
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className={`${boxCls} flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-gray-200 hover:border-gray-900 hover:bg-gray-900/5 transition-colors cursor-pointer disabled:opacity-50`}
        >
          {uploading ? (
            <div className="w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <svg className={`${compact ? "w-4 h-4" : "w-7 h-7"} text-gray-300`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {!compact && (
                <>
                  <span className="text-xs text-gray-400 font-medium">Click to upload</span>
                  <span className="text-[10px] text-gray-300">JPEG · PNG · WebP &nbsp;·&nbsp; max 5 MB</span>
                </>
              )}
            </>
          )}
        </button>
      )}

      {error && <p className="text-[11px] text-red-500 mt-1 leading-tight">{error}</p>}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(ev) => {
          const file = ev.target.files?.[0];
          if (file) handleFile(file);
          ev.target.value = "";
        }}
      />
    </div>
  );
}
