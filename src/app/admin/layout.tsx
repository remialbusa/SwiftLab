import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/staffSession";

/** Shared admin layout with nav + sign out. Admin-only (medtech is redirected). */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getStaffSession();
  if (!session) redirect("/staff/login");
  if (session.identity.role !== "admin") redirect("/staff/orders");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/admin" className="text-lg font-bold text-teal-700">
            SwiftLab <span className="text-slate-700">Admin</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link href="/admin/lab-tests" className="hover:text-teal-700">
              Lab tests
            </Link>
            <Link href="/admin/operating-hours" className="hover:text-teal-700">
              Hours
            </Link>
            <Link href="/admin/settings" className="hover:text-teal-700">
              Settings
            </Link>
            <Link href="/admin/audit-logs" className="hover:text-teal-700">
              Audit log
            </Link>
            <form action="/api/v1/staff/logout" method="POST">
              <button type="submit" className="hover:text-teal-700">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
