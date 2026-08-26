"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useLabTests } from "@/hooks/useLabTests";
import { apiFetch } from "@/lib/api";

type Status =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string }
  | { status: "success"; orderId: string };

export default function WalkInPage() {
  const router = useRouter();
  const tests = useLabTests();
  const [selected, setSelected] = useState<string[]>([]);
  const [fullName, setFullName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [sex, setSex] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<Status>({ status: "idle" });
  const nameId = useId();
  const emailId = useId();

  const toggleTest = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus({ status: "submitting" });
    try {
      const res = await apiFetch("/api/v1/staff/orders/walk-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          lastName,
          dob,
          sex: sex || "prefer_not_to_say",
          email: email || undefined,
          phone: phone || undefined,
          testIds: selected,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        orderId?: string;
      };
      if (!res.ok || !json.ok || !json.orderId) {
        setStatus({
          status: "error",
          message: json.error ?? "Could not create walk-in.",
        });
        return;
      }
      setStatus({ status: "success", orderId: json.orderId });
    } catch {
      setStatus({ status: "error", message: "Network error." });
    }
  };

  if (status.status === "success") {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-teal-200 bg-teal-50 p-6 text-center">
        <h1 className="text-lg font-bold text-teal-900">Walk-in created!</h1>
        <button
          onClick={() => router.push(`/staff/orders/${status.orderId}`)}
          className="mt-4 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
        >
          Open order
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-bold text-slate-900">New walk-in order</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-slate-700">
            Select tests
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {tests.status === "ready" &&
              tests.tests.map((test) => {
                const checked = selected.includes(test.id);
                return (
                  <label
                    key={test.id}
                    className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 text-sm ${checked ? "border-teal-500 bg-teal-50" : "border-slate-200"}`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTest(test.id)}
                        className="h-4 w-4 rounded text-teal-600"
                      />
                      <span>{test.name}</span>
                    </span>
                    <span className="font-medium text-slate-700">
                      ₱{Number(test.cash_price).toFixed(2)}
                    </span>
                  </label>
                );
              })}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label
              htmlFor={nameId}
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              First name
            </label>
            <input
              id={nameId}
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Last name
            </label>
            <input
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Birth date
            </label>
            <input
              type="date"
              required
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Sex / Gender
            </label>
            <select
              value={sex}
              onChange={(e) => setSex(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select…</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>
          <div>
            <label
              htmlFor={emailId}
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Email (optional)
            </label>
            <input
              id={emailId}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Phone (optional)
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {status.status === "error" && (
          <p className="text-sm font-medium text-red-600">{status.message}</p>
        )}
        <button
          type="submit"
          disabled={status.status === "submitting" || selected.length === 0}
          className="w-full rounded-lg bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {status.status === "submitting"
            ? "Creating…"
            : "Create walk-in order"}
        </button>
      </form>
    </div>
  );
}
