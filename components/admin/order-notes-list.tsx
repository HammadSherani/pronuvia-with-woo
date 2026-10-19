import type { OrderNoteRow } from "@/actions/admin/order-notes";
import { formatDateTime } from "@/lib/utils/timezone";

// Order notes, read only: they are added and managed on the WooCommerce
// order in WP admin (private notes and notes to the customer).
export function OrderNotesList({ notes, wooHref }: { notes: OrderNoteRow[]; wooHref: string | null }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Order Notes</h3>
        <span className="text-xs text-gray-400">{notes.length} note{notes.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="px-4 py-3 space-y-3 max-h-72 overflow-y-auto">
        {notes.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">No notes yet.</p>
        ) : (
          [...notes].reverse().map((note) => (
            <div key={note.id} className={`rounded-lg p-3 ${note.type === "private" ? "bg-amber-50 border border-amber-100" : "bg-teal-50 border border-teal-100"}`}>
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${note.type === "private" ? "bg-amber-100 text-amber-700" : "bg-teal-100 text-teal-700"}`}>
                  {note.type === "private" ? "Private" : "Patient"}
                </span>
                <span className="text-[10px] text-gray-400">{formatDateTime(note.createdAt)}</span>
              </div>
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap break-words">{note.content}</p>
            </div>
          ))
        )}
      </div>
      {wooHref && (
        <div className="px-4 py-3 border-t border-gray-100">
          <a href={wooHref} target="_blank" rel="noreferrer" className="text-xs font-medium text-[#3DBFA4] hover:underline">
            Add a note in WooCommerce ↗
          </a>
        </div>
      )}
    </div>
  );
}
