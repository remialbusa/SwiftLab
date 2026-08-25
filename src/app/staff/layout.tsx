import Link from "next/link";
import { getStaffSession } from "@/lib/staffSession";

/** Shared staff layout with nav + sign out (nav hidden on the login page). */
export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getStaffSession();
  const authed = Boolean(session);
  const isAdmin = session?.identity.role === "admin";

  return (
    <div className="min-h-screen bg-slate-50">
      {authed && (
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link
              href="/staff/orders"
              className="text-lg font-bold text-teal-700"
            >
              SwiftLab <span className="text-slate-700">Staff</span>
            </Link>
            <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
              <Link href="/staff/orders" className="hover:text-teal-700">
                Orders
              </Link>
              <Link href="/staff/walk-in" className="hover:text-teal-700">
                Walk-in
              </Link>
              {isAdmin && (
                <Link href="/admin" className="hover:text-teal-700">
                  Admin
                </Link>
              )}
              <form action="/api/v1/staff/logout" method="POST">
                <button type="submit" className="hover:text-teal-700">
                  Sign out
                </button>
              </form>
            </nav>
          </div>
        </header>
      )}
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
