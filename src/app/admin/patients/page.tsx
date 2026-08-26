import { getStaffSession } from "@/lib/staffSession";
import { isAdmin } from "@/lib/staffAuth";
import { getServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PatientsTable from "./patients-table";

interface PatientRow {
  id: string;
  full_name: string;
  last_name: string;
  dob: string;
  email: string;
  created_at: string;
  orders: { count: number }[] | null;
}

async function fetchPatients(
  filter: "all" | { ids: string[] },
): Promise<PatientRow[]> {
  const client = getServiceClient();
  let query = client
    .from("patients")
    .select("id, full_name, last_name, dob, email, created_at, orders(count)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (filter !== "all") {
    if (filter.ids.length === 0) return [];
    query = query.in("id", filter.ids);
  }
  const { data } = await query;
  return (data ?? []) as PatientRow[];
}

export default async function AdminPatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const session = await getStaffSession();
  if (!session || !(await isAdmin(session.identity.id))) {
    redirect("/staff/login");
  }

  const { search } = await searchParams;
  const client = getServiceClient();

  let rows: PatientRow[];
  if (search) {
    const { data: ids } = await client
      .from("patients")
      .select("id")
      .or(
        `full_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`,
      )
      .limit(500);
    rows = await fetchPatients({ ids: (ids ?? []).map((p) => p.id as string) });
  } else {
    rows = await fetchPatients("all");
  }

  const patients =
    rows.map((p) => ({
      id: p.id,
      fullName: p.full_name,
      lastName: p.last_name,
      dob: p.dob,
      email: p.email,
      createdAt: p.created_at,
      orderCount: Array.isArray(p.orders) ? p.orders.length : 0,
    })) ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Patients</h1>
      <p className="text-sm text-slate-500">
        Manage patient records. Deleting a patient permanently removes them and
        all of their orders, results, and uploaded PDFs. This cannot be undone.
      </p>
      <PatientsTable initialPatients={patients} initialSearch={search} />
    </div>
  );
}
