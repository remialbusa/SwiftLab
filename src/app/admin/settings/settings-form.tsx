"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

interface Settings {
  resultsUnlockMaxAttempts: number;
  resultsUnlockWindowMinutes: number;
  resultsLinkTtlDays: number;
  trackingLinkTtlDays: number;
}

export default function AdminSettingsClient({
  initialSettings,
}: {
  initialSettings: Settings;
}) {
  const [form, setForm] = useState<Settings>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const setField = (key: keyof Settings, value: string) => {
    setForm({ ...form, [key]: Number(value) });
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    const res = await apiFetch("/api/v1/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setSaveError(json?.error ?? "Could not save settings.");
      return;
    }
    setSaved(true);
  };

  const fields: { key: keyof Settings; label: string; hint: string }[] = [
    {
      key: "resultsUnlockMaxAttempts",
      label: "Results unlock max attempts",
      hint: "Failed attempts allowed per IP before lockout.",
    },
    {
      key: "resultsUnlockWindowMinutes",
      label: "Results unlock window (minutes)",
      hint: "Time window the attempt limit applies to.",
    },
    {
      key: "resultsLinkTtlDays",
      label: "Results link expiry (days)",
      hint: "How long a results download link stays valid.",
    },
    {
      key: "trackingLinkTtlDays",
      label: "Tracking link expiry (days)",
      hint: "How long an order tracking link stays valid.",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <button
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>

      {saveError && (
        <p className="text-sm font-medium text-red-600">{saveError}</p>
      )}
      {saved && (
        <p className="text-sm font-medium text-teal-700">Settings saved.</p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {field.label}
              </label>
              <input
                type="number"
                min="1"
                value={form[field.key]}
                onChange={(e) => setField(field.key, e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-slate-400">{field.hint}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
