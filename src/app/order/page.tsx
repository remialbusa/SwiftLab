"use client";

import { useId, useState } from "react";
import { useLabTests } from "@/hooks/useLabTests";
import Header from "@/components/Header";
import { apiFetch } from "@/lib/api";

type FormStatus =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; trackingToken: string; trackingCode: string }
  | { status: "error"; message: string };

export default function OrderPage() {
  const tests = useLabTests();
  const [selected, setSelected] = useState<string[]>([]);
  const [fullName, setFullName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [sex, setSex] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<FormStatus>({ status: "idle" });
  const nameId = useId();
  const lastNameId = useId();
  const dobId = useId();
  const sexId = useId();
  const emailId = useId();
  const phoneId = useId();

  const toggleTest = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  };

  // Auto-compute age from the Date of Birth.
  const computeAge = (birthDate: string): string => {
    if (!birthDate) return "";
    const birth = new Date(birthDate);
    if (Number.isNaN(birth.getTime())) return "";
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
    return age >= 0 ? String(age) : "";
  };

  const age = computeAge(dob);

  const total =
    tests.status === "ready"
      ? tests.tests
          .filter((t) => selected.includes(t.id))
          .reduce((sum, t) => sum + Number(t.cash_price), 0)
      : 0;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!consent) {
      setStatus({
        status: "error",
        message: "Please agree to the privacy notice.",
      });
      return;
    }
    setStatus({ status: "submitting" });
    try {
      const res = await apiFetch("/api/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          lastName,
          dob,
          sex: sex || "prefer_not_to_say",
          email,
          phone: phone || undefined,
          testIds: selected,
          privacyConsent: consent,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        trackingToken?: string;
        trackingCode?: string;
      };
      if (!res.ok || !json.ok || !json.trackingToken) {
        setStatus({
          status: "error",
          message: json.error ?? "Could not create order.",
        });
        return;
      }
      setStatus({
        status: "success",
        trackingToken: json.trackingToken,
        trackingCode: json.trackingCode ?? "",
      });
    } catch {
      setStatus({
        status: "error",
        message: "Network error. Please try again.",
      });
    }
  };

  if (status.status === "success") {
    const trackUrl = `${window.location.origin}/track`;
    return (
      <>
        <Header />
        <main className="mx-auto w-full max-w-xl px-4 py-12">
          <div className="card p-6">
            <div className="rounded-xl border border-teal-border bg-teal-bg p-6 text-center">
              <h1 className="font-poppins text-xl font-semibold text-navy-deep">
                Request submitted!
              </h1>
              <p className="mt-2 text-sm text-navy-mid">
                Your tracking code has been sent to your email.
              </p>
              {status.trackingCode && (
                <div className="mx-auto mt-4 w-fit rounded-lg border border-teal-border bg-white px-5 py-3 font-mono text-lg tracking-widest text-navy-deep">
                  {status.trackingCode}
                </div>
              )}
              <p className="mt-4 text-xs text-navy-mid">
                Save your code, or track online:
              </p>
              <a
                href={trackUrl}
                className="mt-2 inline-flex rounded-lg bg-green px-4 py-2 text-sm font-semibold text-white hover:bg-green-dark"
              >
                Track my request
              </a>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-2xl px-4 py-10">
        <p className="eyebrow">Lab Request Form</p>
        <h1 className="mb-1 font-poppins text-2xl font-semibold text-navy-deep">
          Request a lab test
        </h1>
        <p className="text-sm text-muted">
          Select the tests you need and provide your details. We&apos;ll email
          your tracking key.
        </p>

        <form className="card mt-6 px-8 py-6" onSubmit={handleSubmit}>
          <label className="field-label font-semibold text-navy-deep">
            Tests requested
          </label>
          {tests.status === "loading" && (
            <p className="mt-2 text-sm text-muted">Loading tests…</p>
          )}
          {tests.status === "error" && (
            <p className="mt-2 text-sm text-red">{tests.message}</p>
          )}
          {tests.status === "ready" && (
            <div className="mt-3 space-y-2">
              {tests.tests.map((test) => {
                const checked = selected.includes(test.id);
                return (
                  <label
                    key={test.id}
                    className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition ${
                      checked
                        ? "border-teal-border bg-teal-bg"
                        : "border-[#eef3f3] bg-white hover:border-teal-border"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTest(test.id)}
                        className="h-4 w-4 rounded border-teal-border text-green"
                      />
                      <span>
                        <span className="block text-sm font-medium text-ink">
                          {test.name}
                        </span>
                        <span className="block text-xs text-muted">
                          ~{test.duration_minutes} min
                        </span>
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-navy-deep">
                      ₱{Number(test.cash_price).toFixed(2)}
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          <div className="mt-2 grid gap-0 sm:grid-cols-2 sm:gap-x-4">
            <div>
              <label htmlFor={nameId} className="field-label">
                First name
              </label>
              <input
                id={nameId}
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="field-input"
                placeholder="Juan"
              />
            </div>
            <div>
              <label htmlFor={lastNameId} className="field-label">
                Last name
              </label>
              <input
                id={lastNameId}
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="field-input"
                placeholder="Dela Cruz"
              />
            </div>
            <div>
              <label htmlFor={dobId} className="field-label">
                Date of birth
              </label>
              <input
                id={dobId}
                type="date"
                required
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="field-input"
              />
            </div>
            <div>
              <label htmlFor={sexId} className="field-label">
                Sex / Gender
              </label>
              <select
                id={sexId}
                required
                value={sex}
                onChange={(e) => setSex(e.target.value)}
                className="field-input"
              >
                <option value="">Select…</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <span className="field-label">Age</span>
              <input
                readOnly
                value={age ? `${age} years` : "—"}
                className="field-input bg-slate-50"
                placeholder="Auto-computed from birth date"
              />
              <p className="mt-1 text-xs text-muted">
                Automatically computed from your date of birth.
              </p>
            </div>
            <div>
              <label htmlFor={emailId} className="field-label">
                Email address
              </label>
              <input
                id={emailId}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field-input"
                placeholder="you@example.com"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor={phoneId} className="field-label">
                Contact number
              </label>
              <input
                id={phoneId}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="field-input"
                placeholder="+63 912 345 6789"
              />
            </div>
          </div>

          <label className="mt-5 flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-teal-border text-green"
            />
            <span>
              I consent to SwiftLab storing my personal information and test
              results to process this order, per our privacy notice. I
              understand my results are delivered only to the email I provide.
            </span>
          </label>

          {status.status === "error" && (
            <p className="mt-3 text-sm font-medium text-red">
              {status.message}
            </p>
          )}

          <button
            type="submit"
            disabled={status.status === "submitting" || selected.length === 0}
            className="btn btn-primary mt-6 w-full justify-center"
          >
            {status.status === "submitting"
              ? "Submitting…"
              : `Submit request — ₱${total.toFixed(2)}`}
          </button>

          <div className="notice">
            <strong>Reminder:</strong> If your test requires fasting, please
            avoid food and water intake for the required hours before your
            visit.
          </div>
        </form>
      </main>
    </>
  );
}
