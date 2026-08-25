import { getStaffSession } from "@/lib/staffSession";
import { isAdmin } from "@/lib/staffAuth";
import { getServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LabTestsTable from "./lab-tests-table";

export default async function AdminLabTestsPage() {
  const session = await getStaffSession();
  if (!session || !(await isAdmin(session.identity.id))) {
    redirect("/staff/login");
  }

  const client = getServiceClient();
  const { data, error } = await client
    .from("lab_tests")
    .select("id, name, code, cash_price, duration_minutes, active")
    .order("name");

  if (error) {
    return <p className="text-sm text-red-600">Could not load tests.</p>;
  }

  return <LabTestsTable initialTests={data ?? []} />;
}
