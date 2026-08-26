import Link from "next/link";

export default function AdminHomePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Admin</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/patients"
          className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-teal-400"
        >
          <h2 className="font-semibold text-slate-800">Patients</h2>
          <p className="mt-1 text-sm text-slate-500">
            View and permanently remove patient records and their data.
          </p>
        </Link>
        <Link
          href="/admin/lab-tests"
          className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-teal-400"
        >
          <h2 className="font-semibold text-slate-800">Lab tests</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage the price list and availability of tests.
          </p>
        </Link>
        <Link
          href="/admin/operating-hours"
          className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-teal-400"
        >
          <h2 className="font-semibold text-slate-800">Operating hours</h2>
          <p className="mt-1 text-sm text-slate-500">
            Configure weekly hours used to generate booking slots.
          </p>
        </Link>
        <Link
          href="/admin/settings"
          className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-teal-400"
        >
          <h2 className="font-semibold text-slate-800">Settings</h2>
          <p className="mt-1 text-sm text-slate-500">
            Tune link expiry and results-unlock rate limits.
          </p>
        </Link>
        <Link
          href="/admin/audit-logs"
          className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-teal-400"
        >
          <h2 className="font-semibold text-slate-800">Audit log</h2>
          <p className="mt-1 text-sm text-slate-500">
            Review the security and activity trail.
          </p>
        </Link>
      </div>
    </div>
  );
}
