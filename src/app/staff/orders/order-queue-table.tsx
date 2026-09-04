"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

/** Rows per page — must match the staff orders API default pageSize. */
const PAGE_SIZE = 20;

interface QueueOrder {
  id: string;
  status: string;
  createdAt: string;
  walkIn: boolean;
  trackingCode: string;
  patientName: string;
  patientEmail: string;
  tests: string[];
}

const STATUS_LABELS: Record<string, string> = {
  pre_registered: "Pre-registered",
  payment_confirmed: "Payment confirmed",
  sample_processing: "Sample processing",
  results_ready: "Results ready",
  cancelled: "Cancelled",
};

export default function OrderQueueTable({
  initialOrders,
  total,
  initialSearch,
  initialStatus,
}: {
  initialOrders: QueueOrder[];
  total: number;
  initialSearch?: string;
  initialStatus?: string;
}) {
  const [search, setSearch] = useState(initialSearch ?? "");
  const [statusFilter, setStatusFilter] = useState(initialStatus ?? "all");
  const [orders, setOrders] = useState(initialOrders);
  const [orderTotal, setOrderTotal] = useState(total);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(orderTotal / PAGE_SIZE));
  const firstOnPage = page === 1 ? 1 : (page - 1) * PAGE_SIZE + 1;
  const lastOnPage = (page - 1) * PAGE_SIZE + orders.length;

  const applyFilters = async (s: string, st: string, p: number) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (s) params.set("search", s);
    if (st && st !== "all") params.set("status", st);
    if (p > 1) params.set("page", String(p));
    try {
      const res = await apiFetch(`/api/v1/staff/orders?${params.toString()}`);
      if (!res.ok) return;
      const json = (await res.json()) as {
        orders: QueueOrder[];
        total: number;
      };
      setOrders(json.orders);
      setOrderTotal(json.total);
      setPage(p);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 space-y-4">
      <form
        className="flex flex-wrap items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void applyFilters(search, statusFilter, 1);
        }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or tracking code…"
          className="min-w-56 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            void applyFilters(search, e.target.value, 1);
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="pre_registered">Pre-registered</option>
          <option value="payment_confirmed">Payment confirmed</option>
          <option value="sample_processing">Sample processing</option>
          <option value="results_ready">Results ready</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-160 text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Tests</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Registered</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <span className="block font-medium text-slate-800">
                    {order.patientName}
                  </span>
                  <span className="block text-xs text-slate-400">
                    {order.patientEmail}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
                    {order.trackingCode || "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {order.tests.slice(0, 3).join(", ")}
                  {order.tests.length > 3 ? "…" : ""}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-semibold text-teal-800">
                    {STATUS_LABELS[order.status] ?? order.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(order.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {order.walkIn ? "Walk-in" : "Online"}
                </td>
                <td className="px-4 py-3 text-right">
                  <a
                    href={`/staff/orders/${order.id}`}
                    className="font-semibold text-teal-700 hover:underline"
                  >
                    Open
                  </a>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-slate-400"
                >
                  No orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <span>
          {orderTotal === 0
            ? "0 orders"
            : `Showing ${firstOnPage}–${lastOnPage} of ${orderTotal} order(s)`}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => void applyFilters(search, statusFilter, page - 1)}
            disabled={page <= 1 || loading}
            className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Previous
          </button>
          <button
            onClick={() => void applyFilters(search, statusFilter, page + 1)}
            disabled={page >= totalPages || loading}
            className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
