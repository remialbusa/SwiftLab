"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type Status =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string };

export default function StaffLoginPage() {
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>({ status: "idle" });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus({ status: "submitting" });
    try {
      const res = await apiFetch("/api/v1/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setStatus({ status: "error", message: json.error ?? "Login failed." });
        return;
      }
      // Middleware appends ?next=<path> when a signed-out user hits a staff or
      // admin page; land them where they were going instead of the queue.
      const next = new URLSearchParams(window.location.search).get("next");
      const isInternal =
        next !== null && next.startsWith("/") && !next.startsWith("//");
      router.push(isInternal ? next : "/staff/orders");
      router.refresh();
    } catch {
      setStatus({
        status: "error",
        message: "Network error. Please try again.",
      });
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4">
      <div className="card px-8 py-8">
        <div className="flex items-center gap-3">
          <div className="brand-mark">SL</div>
          <div>
            <h1 className="font-poppins text-lg font-semibold text-navy-deep">
              SwiftLab
            </h1>
            <span className="text-xs text-muted">Staff Portal</span>
          </div>
        </div>
        <h2 className="mt-6 text-xl font-bold text-slate-900">Staff sign in</h2>
        <p className="mt-1 text-sm text-muted">
          Restricted access for SwiftLab staff.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor={emailId} className="field-label">
              Email
            </label>
            <input
              id={emailId}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field-input"
              placeholder="staff@clinic.ph"
            />
          </div>
          <div>
            <label htmlFor={passwordId} className="field-label">
              Password
            </label>
            <input
              id={passwordId}
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field-input"
              placeholder="••••••••"
            />
          </div>
          {status.status === "error" && (
            <p className="text-sm font-medium text-red">{status.message}</p>
          )}
          <button
            type="submit"
            disabled={status.status === "submitting"}
            className="btn btn-primary w-full justify-center"
          >
            {status.status === "submitting" ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
