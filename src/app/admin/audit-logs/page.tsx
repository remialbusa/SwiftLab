import { getStaffSession } from "@/lib/staffSession";
import { isAdmin } from "@/lib/staffAuth";
import { getServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AuditLogTable from "./audit-log-table";

const PAGE_SIZE = 50;

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string }>;
}) {
  const session = await getStaffSession();
  if (!session || !(await isAdmin(session.identity.id))) {
    redirect("/staff/login");
  }

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const action = sp.action ?? "";
  const from = (page - 1) * PAGE_SIZE;

  const client = getServiceClient();
  let query = client
    .from("audit_logs")
    .select(
      "id, actor_type, actor_id, action, resource_type, resource_id, metadata, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (action) query = query.eq("action", action);

  const { data, count, error } = await query;
  if (error) {
    return <p className="text-sm text-red-600">Could not load audit logs.</p>;
  }

  return (
    <AuditLogTable
      initialLogs={data ?? []}
      total={count ?? 0}
      page={page}
      pageSize={PAGE_SIZE}
      initialAction={action}
    />
  );
}
