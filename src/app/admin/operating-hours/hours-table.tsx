"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

interface HoursRow {
  id: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  active: boolean;
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function AdminOperatingHoursClient({
  initialHours,
}: {
  initialHours: HoursRow[];
}) {
  const [rows, setRows] = useState<HoursRow[]>(initialHours);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const updateRow = (dayOfWeek: number, patch: Partial<HoursRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.day_of_week === dayOfWeek ? { ...r, ...patch } : r)),
    );
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    const res = await apiFetch("/api/v1/admin/operating-hours", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hours: rows.map((r) => ({
          dayOfWeek: r.day_of_week,
          openTime: r.open_time,
          closeTime: r.close_time,
          active: r.active,
        })),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setSaveError(json?.error ?? "Could not save hours.");
      return;
    }
    setSaved(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Operating hours</h1>
        <button
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save hours"}
        </button>
      </div>

      {saveError && (
        <p className="text-sm font-medium text-red-600">{saveError}</p>
      )}
      {saved && (
        <p className="text-sm font-medium text-teal-700">
          Operating hours saved.
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Day</th>
              <th className="px-4 py-3">Open</th>
              <th className="px-4 py-3">Close</th>
              <th className="px-4 py-3">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {DAY_NAMES.map((name, dow) => {
              const row = rows.find((r) => r.day_of_week === dow);
              return (
                <tr key={dow}>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {name}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="time"
                      value={row?.open_time ?? "08:00"}
                      disabled={!row?.active}
                      onChange={(e) =>
                        updateRow(dow, { open_time: e.target.value })
                      }
                      className="rounded-lg border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="time"
                      value={row?.close_time ?? "17:00"}
                      disabled={!row?.active}
                      onChange={(e) =>
                        updateRow(dow, { close_time: e.target.value })
                      }
                      className="rounded-lg border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={row?.active ?? false}
                      onChange={(e) =>
                        updateRow(dow, { active: e.target.checked })
                      }
                      className="h-4 w-4 rounded text-teal-600"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
