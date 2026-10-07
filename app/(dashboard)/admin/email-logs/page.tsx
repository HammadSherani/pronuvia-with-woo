import { getEmailLogs } from "@/actions/admin/email-logs";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/shared/pagination";
import { parsePagination } from "@/lib/pagination";
import { formatDateTime } from "@/lib/utils/timezone";
import { EmailLogStatus } from "@/generated/prisma/enums";
import { Suspense } from "react";
import { EmailLogDetail } from "./_components/email-log-detail";

export const metadata = { title: "Email Logs – Pronuvia Admin" };

const STATUS_STYLES: Record<string, string> = {
  SENT:    "bg-emerald-50 text-emerald-700",
  FAILED:  "bg-red-50 text-red-700",
  QUEUED:  "bg-amber-50 text-amber-700",
  BOUNCED: "bg-orange-50 text-orange-700",
};

export default async function EmailLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { page, pageSize, skip, take } = parsePagination(sp, 25);
  const status = typeof sp.status === "string" && sp.status ? (sp.status as EmailLogStatus) : undefined;
  const search = typeof sp.q === "string" ? sp.q : undefined;

  const { logs, total } = await getEmailLogs({ skip, take, status, search });

  return (
    <div>
      <PageHeader
        title="Email Logs"
        description={`All outgoing system emails (${total} total)`}
      />

      {/* Filters */}
      <form className="flex flex-wrap items-center gap-3 mb-5" method="get">
        <input
          type="text"
          name="q"
          defaultValue={search ?? ""}
          placeholder="Search recipient, subject, or related ID…"
          className="w-72 border border-gray-200 rounded-lg px-3.5 py-2 text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition bg-white"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition bg-white"
        >
          <option value="">All statuses</option>
          <option value="SENT">Sent</option>
          <option value="FAILED">Failed</option>
          <option value="QUEUED">Queued</option>
          <option value="BOUNCED">Bounced</option>
        </select>
        <button type="submit" className="px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold rounded-lg transition-colors">
          Filter
        </button>
        {(status || search) && (
          <a href="/admin/email-logs" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            Clear filters
          </a>
        )}
      </form>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500">No emails logged yet</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Timestamp (ET)</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Recipient</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Subject / Type</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Related ID</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors align-top">
                      <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                      <td className="px-5 py-3.5 text-gray-700">{log.recipientEmail}</td>
                      <td className="px-5 py-3.5 text-gray-700">
                        <p className="font-medium text-gray-800 line-clamp-1">{log.subject}</p>
                        {log.type && <p className="text-xs text-gray-400 mt-0.5">{log.type}</p>}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 font-mono text-xs">{log.relatedId ?? "—"}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[log.status] ?? STATUS_STYLES.QUEUED}`}>
                          {log.status.charAt(0) + log.status.slice(1).toLowerCase()}
                        </span>
                        {log.provider && <span className="block text-[10px] text-gray-300 mt-1 uppercase tracking-wide">{log.provider}</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <EmailLogDetail
                          errorMessage={log.errorMessage}
                          responsePayload={log.responsePayload as Record<string, unknown> | null}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Suspense>
              <Pagination total={total} page={page} pageSize={pageSize} />
            </Suspense>
          </>
        )}
      </div>
    </div>
  );
}
