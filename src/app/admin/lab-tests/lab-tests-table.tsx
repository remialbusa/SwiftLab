"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

interface LabTest {
  id: string;
  name: string;
  code: string;
  cash_price: number;
  duration_minutes: number;
  active: boolean;
}

const EMPTY_FORM = {
  name: "",
  code: "",
  cashPrice: "",
  durationMinutes: "",
};

export default function AdminLabTestsClient({
  initialTests,
}: {
  initialTests: LabTest[];
}) {
  const [tests, setTests] = useState<LabTest[]>(initialTests);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const refresh = async () => {
    const res = await apiFetch("/api/v1/admin/lab-tests");
    if (!res.ok) return;
    const json = (await res.json()) as { tests: LabTest[] };
    setTests(json.tests);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setSaveError(null);
    const payload = {
      name: form.name,
      code: form.code,
      cashPrice: Number(form.cashPrice),
      durationMinutes: Number(form.durationMinutes),
    };
    const res = await apiFetch(
      editingId
        ? `/api/v1/admin/lab-tests/${editingId}`
        : "/api/v1/admin/lab-tests",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setFormError(json?.error ?? "Could not save test.");
      return;
    }
    setForm(EMPTY_FORM);
    setEditingId(null);
    await refresh();
  };

  const startEdit = (test: LabTest) => {
    setEditingId(test.id);
    setForm({
      name: test.name,
      code: test.code,
      cashPrice: String(test.cash_price),
      durationMinutes: String(test.duration_minutes),
    });
    setFormError(null);
  };

  const deactivate = async (test: LabTest) => {
    if (!confirm(`Deactivate "${test.name}"?`)) return;
    const res = await apiFetch(`/api/v1/admin/lab-tests/${test.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setSaveError(json?.error ?? "Could not deactivate test.");
      return;
    }
    await refresh();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Lab tests</h1>

      {saveError && (
        <p className="text-sm font-medium text-red-600">{saveError}</p>
      )}

      <form
        onSubmit={submit}
        className="rounded-xl border border-slate-200 bg-white p-5"
      >
        <h2 className="text-sm font-semibold text-slate-700">
          {editingId ? "Edit test" : "Add test"}
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Name
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Code
            </label>
            <input
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Cash price (₱)
            </label>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={form.cashPrice}
              onChange={(e) => setForm({ ...form, cashPrice: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Duration (minutes)
            </label>
            <input
              required
              type="number"
              min="1"
              value={form.durationMinutes}
              onChange={(e) =>
                setForm({ ...form, durationMinutes: e.target.value })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        {formError && (
          <p className="mt-3 text-sm font-medium text-red-600">{formError}</p>
        )}
        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            {editingId ? "Save changes" : "Add test"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY_FORM);
                setFormError(null);
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tests.map((test) => (
              <tr key={test.id}>
                <td className="px-4 py-3 font-medium text-slate-800">
                  {test.name}
                </td>
                <td className="px-4 py-3 text-slate-500">{test.code}</td>
                <td className="px-4 py-3 text-slate-700">
                  ₱{Number(test.cash_price).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {test.duration_minutes} min
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      test.active
                        ? "bg-teal-100 text-teal-800"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {test.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => startEdit(test)}
                    className="mr-2 text-teal-700 hover:underline"
                  >
                    Edit
                  </button>
                  {test.active && (
                    <button
                      onClick={() => void deactivate(test)}
                      className="text-red-600 hover:underline"
                    >
                      Deactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {tests.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-slate-400"
                >
                  No tests yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
