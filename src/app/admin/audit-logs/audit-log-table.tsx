"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AuditEntry {
  id: string;
  actor_type: string;
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export default function AdminAuditLogsClient({
  initialLogs,
  total,
  page,
  pageSize,
  initialAction,
}: {
  initialLogs: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  initialAction: string;
}) {
  const router = useRouter();
  const [logs] = useState<AuditEntry[]>(initialLogs);
  const [actionFilter, setActionFilter] = useState(initialAction);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const applyFilter = (action: string) => {
    setActionFilter(action);
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    router.push(`/admin/audit-logs?${params.toString()}`);
  };

  const goToPage = (target: number) => {
    const params = new URLSearchParams();
    if (actionFilter) params.set("action", actionFilter);
    params.set("page", String(target));
    router.push(`/admin/audit-logs?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">Audit log</h1>
        <input
          value={actionFilter}
          onChange={(e) => applyFilter(e.target.value)}
          placeholder="Filter by action…"
          className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-180 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Resource</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {log.actor_type}
                  {log.actor_id ? ` · ${log.actor_id.slice(0, 8)}` : ""}
                </td>
                <td className="px-4 py-3 font-medium text-slate-800">
                  {log.action}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {log.resource_type}
                  {log.resource_id ? ` · ${log.resource_id.slice(0, 8)}` : ""}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {Object.keys(log.metadata ?? {}).length > 0
                    ? JSON.stringify(log.metadata)
                    : "—"}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-slate-400"
                >
                  No audit entries.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          Page {page} of {totalPages} · {total} entries
        </span>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
