"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

interface Patient {
  id: string;
  fullName: string;
  lastName: string;
  dob: string;
  email: string;
  createdAt: string;
  orderCount: number;
}

const SEX_LABELS: Record<string, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
  prefer_not_to_say: "Prefer not to say",
};

export default function PatientsTable({
  initialPatients,
  initialSearch,
}: {
  initialPatients: Patient[];
  initialSearch?: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch ?? "");
  const [patients, setPatients] = useState<Patient[]>(initialPatients);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const applySearch = () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    router.push(`/admin/patients?${params.toString()}`);
  };

  const refresh = async () => {
    const res = await apiFetch("/api/v1/admin/patients");
    if (!res.ok) return;
    const json = (await res.json()) as { patients: Patient[] };
    setPatients(json.patients);
  };

  const doDelete = async (patient: Patient) => {
    setDeletingId(patient.id);
    setError(null);
    const res = await apiFetch(`/api/v1/admin/patients/${patient.id}`, {
      method: "DELETE",
    });
    setDeletingId(null);
    setConfirmId(null);
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(json?.error ?? "Could not delete patient.");
      return;
    }
    await refresh();
  };

  const patientLabel = (p: Patient) =>
    `${p.fullName} ${p.lastName}`.trim() || p.email;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") applySearch();
          }}
          placeholder="Search by name or email…"
          className="min-w-56 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          onClick={applySearch}
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
        >
          Search
        </button>
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-180 text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Birth date</th>
              <th className="px-4 py-3">Orders</th>
              <th className="px-4 py-3">Registered</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {patients.map((patient) => (
              <tr key={patient.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <span className="block font-medium text-slate-800">
                    {patientLabel(patient)}
                  </span>
                  {patient.dob && (
                    <span className="block text-xs text-slate-400">
                      {patient.dob}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{patient.email}</td>
                <td className="px-4 py-3 text-slate-500">
                  {patient.dob || "—"}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {patient.orderCount}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(patient.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  {confirmId === patient.id ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="text-xs text-slate-500">
                        Delete {patientLabel(patient)} and all their data?
                      </span>
                      <button
                        onClick={() => void doDelete(patient)}
                        disabled={deletingId === patient.id}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {deletingId === patient.id ? "Deleting…" : "Confirm"}
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setError(null);
                        setConfirmId(patient.id);
                      }}
                      className="font-semibold text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {patients.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-slate-400"
                >
                  No patients found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
