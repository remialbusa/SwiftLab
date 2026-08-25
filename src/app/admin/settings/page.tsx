import { getStaffSession } from "@/lib/staffSession";
import { isAdmin } from "@/lib/staffAuth";
import { getSettings } from "@/lib/settings";
import { redirect } from "next/navigation";
import SettingsForm from "./settings-form";

export default async function AdminSettingsPage() {
  const session = await getStaffSession();
  if (!session || !(await isAdmin(session.identity.id))) {
    redirect("/staff/login");
  }

  const settings = await getSettings();
  return <SettingsForm initialSettings={settings} />;
}
