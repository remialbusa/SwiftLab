import { Suspense } from "react";
import { getStaffSession } from "@/lib/staffSession";
import { getServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import OrderQueueTable from "./order-queue-table";

const PAGE_SIZE = 20;

async function fetchOrders(
  search: string | undefined,
  statusFilter: string | undefined,
) {
  const client = getServiceClient();
  let query = client
    .from("orders")
    .select(
      "id, status, created_at, walk_in, patients(full_name, email), order_tests(lab_tests(name))",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(0, PAGE_SIZE - 1);

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }
  if (search) {
    const { data: patients } = await client
      .from("patients")
      .select("id")
      .or(
        `full_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`,
      );
    if (!patients || patients.length === 0) return { orders: [], total: 0 };
    query = query.in(
      "patient_id",
      patients.map((p) => p.id as string),
    );
  }

  const { data, count } = await query;
  const orders = (data ?? []).map((o) => ({
    id: o.id,
    status: o.status,
    createdAt: o.created_at,
    walkIn: o.walk_in,
    patientName:
      (o.patients as { full_name?: string } | null)?.full_name ?? "Unknown",
    patientEmail: (o.patients as { email?: string } | null)?.email ?? "",
    tests: ((o.order_tests as { lab_tests?: { name?: string } }[]) ?? []).map(
      (t) => t.lab_tests?.name ?? "Unknown",
    ),
  }));
  return { orders, total: count ?? 0 };
}

export default async function StaffOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>;
}) {
  const session = await getStaffSession();
  if (!session) redirect("/staff/login");

  const sp = await searchParams;
  const { orders, total } = await fetchOrders(sp.search, sp.status);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Order queue</h1>
        <span className="text-sm text-slate-500">{total} order(s)</span>
      </div>
      <Suspense
        fallback={<p className="mt-6 text-sm text-slate-400">Loading…</p>}
      >
        <OrderQueueTable
          initialOrders={orders}
          total={total}
          initialSearch={sp.search}
          initialStatus={sp.status}
        />
      </Suspense>
    </div>
  );
}
