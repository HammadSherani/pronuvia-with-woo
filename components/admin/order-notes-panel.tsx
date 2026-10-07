"use client";

import { useState, useTransition, useOptimistic } from "react";
import toast from "react-hot-toast";
import { addOrderNote, deleteOrderNote, type NoteType, type OrderNoteRow } from "@/actions/admin/order-notes";
import { formatDateTime as formatDate } from "@/lib/utils/timezone";

type NoteRow = OrderNoteRow & { pending?: boolean };

export function OrderNotesPanel({ orderId, initialNotes }: { orderId: string; initialNotes: OrderNoteRow[] }) {
  const [type, setType]       = useState<NoteType>("private");
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();

  const [notes, addOptimistic] = useOptimistic<NoteRow[], NoteRow>(
    initialNotes,
    (state, note) => [...state, note],
  );

  const handleAdd = () => {
    const trimmed = content.trim();
    if (!trimmed) { toast.error("Note cannot be empty."); return; }
    const optimistic: NoteRow = {
      id: `tmp-${Date.now()}`, type, content: trimmed,
      createdAt: new Date(), pending: true,
    };
    startTransition(async () => {
      addOptimistic(optimistic);
      setContent("");
      const res = await addOrderNote(orderId, type, trimmed);
      if (!res.success) toast.error(res.message ?? "Failed to add note.");
      else if (type === "customer") toast.success("Note added & email sent to patient.");
      else toast.success("Private note added.");
    });
  };

  const handleDelete = (noteId: string) => {
    startTransition(async () => {
      const res = await deleteOrderNote(noteId, orderId);
      if (!res.success) toast.error("Failed to delete note.");
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Order Notes</h3>
        <span className="text-xs text-gray-400">{notes.length} note{notes.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Timeline */}
      <div className="px-4 py-3 space-y-3 max-h-72 overflow-y-auto">
        {notes.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">No notes yet.</p>
        ) : (
          [...notes].reverse().map((note) => (
            <div key={note.id} className={`group relative rounded-lg p-3 ${note.pending ? "opacity-60" : ""} ${
              note.type === "private"
                ? "bg-amber-50 border border-amber-100"
                : "bg-teal-50 border border-teal-100"
            }`}>
              {/* Badge + delete */}
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  note.type === "private"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-teal-100 text-teal-700"
                }`}>
                  {note.type === "private" ? (
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  ) : (
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  )}
                  {note.type === "private" ? "Private" : "Patient"}
                </span>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-[10px] text-gray-400">{formatDate(note.createdAt)}</span>
                  {!note.pending && (
                    <button
                      type="button"
                      onClick={() => handleDelete(note.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-400"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap break-words">{note.content}</p>
            </div>
          ))
        )}
      </div>

      {/* Add note form */}
      <div className="px-4 pb-4 pt-2 border-t border-gray-100">
        {/* Type selector */}
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={() => setType("private")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
              type === "private"
                ? "bg-amber-50 border-amber-300 text-amber-700"
                : "bg-white border-gray-200 text-gray-400 hover:border-gray-300"
            }`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Private
          </button>
          <button
            type="button"
            onClick={() => setType("customer")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
              type === "customer"
                ? "bg-teal-50 border-teal-300 text-teal-700"
                : "bg-white border-gray-200 text-gray-400 hover:border-gray-300"
            }`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Patient
          </button>
        </div>

        <p className="text-[10px] text-gray-400 mb-2">
          {type === "private"
            ? "Only visible to admin — not sent to patient."
            : "Will be emailed to the patient immediately."}
        </p>

        <textarea
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={type === "private" ? "Add a private note…" : "Write a message to the patient…"}
          className="w-full px-3 py-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 resize-none text-gray-700 placeholder:text-gray-300"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAdd(); }}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={isPending || !content.trim()}
          className={`mt-2 w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-white rounded-lg transition-colors disabled:opacity-50 ${
            type === "private" ? "bg-gray-700 hover:bg-gray-800" : "bg-gray-900 hover:bg-gray-700"
          }`}
        >
          {type === "private" ? "Add Private Note" : "Send to Patient"}
        </button>
      </div>
    </div>
  );
}
