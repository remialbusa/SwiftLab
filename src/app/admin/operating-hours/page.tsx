import { getStaffSession } from "@/lib/staffSession";
import { isAdmin } from "@/lib/staffAuth";
import { getServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import HoursTable from "./hours-table";

export default async function AdminOperatingHoursPage() {
  const session = await getStaffSession();
  if (!session || !(await isAdmin(session.identity.id))) {
    redirect("/staff/login");
  }

  const client = getServiceClient();
  const { data, error } = await client
    .from("operating_hours")
    .select("id, day_of_week, open_time, close_time, active")
    .order("day_of_week");

  if (error) {
    return <p className="text-sm text-red-600">Could not load hours.</p>;
  }

  return <HoursTable initialHours={data ?? []} />;
}
