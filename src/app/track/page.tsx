"use client";

import { useState } from "react";
import Header from "@/components/Header";
import { apiFetch } from "@/lib/api";

interface OrderSummary {
  id: string;
  status: string;
  createdAt: string;
  tests: string[];
  appointment: { slotStart: string; slotEnd: string; status: string } | null;
}

const STATUS_LABELS: Record<string, string> = {
  pre_registered: "Pre-registered",
  payment_confirmed: "Payment confirmed",
  sample_processing: "Sample processing",
  results_ready: "Report Ready",
  cancelled: "Cancelled",
};

const BADGE_CLASS: Record<string, string> = {
  pre_registered: "bg-[#FDF0DF] text-amber",
  payment_confirmed: "bg-[#FDF0DF] text-amber",
  sample_processing: "bg-[#FDF0DF] text-amber",
  results_ready: "bg-[#E4F6EC] text-green-dark",
  cancelled: "bg-[#FBE7E7] text-red",
};

const STEPS = [
  { label: "Request\nReceived", status: "pre_registered" },
  { label: "Payment\nConfirmed", status: "payment_confirmed" },
  { label: "Sample\nCollected", status: "sample_processing" },
  { label: "Testing &\nAnalysis", status: "sample_processing" },
  { label: "Report\nReady", status: "results_ready" },
] as const;

function statusIndex(status: string): number {
  return STEPS.findIndex((s) => s.status === status);
}

type LookupState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "error"; message: string }
  | { status: "found"; summary: OrderSummary; code: string };

export default function TrackEntryPage() {
  const [code, setCode] = useState("");
  const [state, setState] = useState<LookupState>({ status: "idle" });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setState({ status: "checking" });
    try {
      const res = await apiFetch("/api/v1/track/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = (await res.json()) as {
        error?: string;
        summary?: OrderSummary;
      };
      if (!res.ok || !json.summary) {
        setState({
          status: "error",
          message: json.error ?? "Could not look up that code.",
        });
        return;
      }
      setState({
        status: "found",
        summary: json.summary,
        code: code.trim().toUpperCase(),
      });
    } catch {
      setState({
        status: "error",
        message: "Network error. Please try again.",
      });
    }
  };

  const { summary, currentIdx, isCancelled, isDone } =
    state.status === "found"
      ? {
          summary: state.summary,
          currentIdx: statusIndex(state.summary.status),
          isCancelled: state.summary.status === "cancelled",
          isDone: state.summary.status === "results_ready",
        }
      : { summary: null, currentIdx: -1, isCancelled: false, isDone: false };

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        {state.status !== "found" && (
          <div className="card px-8 py-10 text-center">
            <div className="eyebrow">Track a request</div>
            <h2 className="font-poppins text-xl font-semibold text-navy-deep">
              Where&apos;s my lab request?
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
              Enter the unique key printed on your receipt or sent to your
              e-mail to check the status of your laboratory test.
            </p>
            <form
              onSubmit={handleSubmit}
              className="mt-7 flex flex-wrap justify-center gap-3"
            >
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. SL-7K2F9Q"
                maxLength={20}
                required
                className="w-72 rounded-[10px] border-[1.5px] border-teal-border bg-teal-bg px-4 py-3.5 text-center font-mono text-lg lowercase tracking-wide text-navy-deep placeholder:text-sm placeholder:uppercase placeholder:tracking-widest placeholder:text-[#8FB4C4] focus:border-green focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={state.status === "checking"}
                className="rounded-[10px] bg-green px-7 py-3 font-poppins text-sm font-semibold text-white hover:bg-green-dark disabled:opacity-50"
              >
                {state.status === "checking" ? "Checking…" : "Check Status"}
              </button>
            </form>
            {state.status === "error" && (
              <p className="mt-4 text-sm font-medium text-red">
                {state.message}
              </p>
            )}
            <div className="mt-4 text-xs text-muted">
              Your unique key is case-insensitive and does not expire.
            </div>
          </div>
        )}

        {state.status === "found" && summary && (
          <>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="eyebrow">Track a request</div>
                <h2 className="font-poppins text-xl font-semibold text-navy-deep">
                  {summary.tests.join(", ")}
                </h2>
              </div>
              <button
                onClick={() => setState({ status: "idle" })}
                className="text-sm font-medium text-green hover:underline"
              >
                ← Check another
              </button>
            </div>

            <div className="card px-8 py-8">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-dashed border-[#DCE7E9] pb-6">
                <div>
                  <div className="font-mono text-[11.5px] uppercase tracking-[1.5px] text-muted">
                    Request Key · {state.code}
                  </div>
                  <h3 className="mt-1 font-poppins text-lg font-semibold text-navy-deep">
                    {summary.tests.join(", ")}
                  </h3>
                </div>
                <span className={`badge ${BADGE_CLASS[summary.status] ?? ""}`}>
                  {STATUS_LABELS[summary.status] ?? summary.status}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-5 border-b border-dashed border-[#DCE7E9] py-6 sm:grid-cols-3">
                <div>
                  <div className="text-[11.5px] uppercase tracking-wide text-muted">
                    Requested
                  </div>
                  <div className="mt-1 font-poppins text-sm font-semibold text-ink">
                    {new Date(summary.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <div className="text-[11.5px] uppercase tracking-wide text-muted">
                    Appointment
                  </div>
                  <div className="mt-1 font-poppins text-sm font-semibold text-ink">
                    {summary.appointment
                      ? `${summary.appointment.slotStart}–${summary.appointment.slotEnd}`
                      : "Not scheduled"}
                  </div>
                </div>
                <div>
                  <div className="text-[11.5px] uppercase tracking-wide text-muted">
                    Tests
                  </div>
                  <div className="mt-1 font-poppins text-sm font-semibold text-ink">
                    {summary.tests.length} requested
                  </div>
                </div>
              </div>

              {!isCancelled && (
                <div className="pt-8">
                  <div className="mb-7 font-poppins text-sm font-semibold text-navy-deep">
                    Request progress
                  </div>
                  <div className="relative">
                    <div className="absolute left-0 right-0 top-3.75 h-0.75 bg-[#E1EBEC]" />
                    <div
                      className="absolute left-0 top-3.75 h-0.75 bg-green transition-all"
                      style={{
                        width: isDone
                          ? "100%"
                          : `${Math.max(0, (currentIdx / (STEPS.length - 1)) * 100)}%`,
                      }}
                    />
                    <div className="relative z-10 flex">
                      {STEPS.map((step, i) => {
                        const isDoneStep = i <= currentIdx && !isCancelled;
                        const isCurrentStep = i === currentIdx && !isDone;
                        return (
                          <div key={step.label} className="flex-1 text-center">
                            <div
                              className={`mx-auto mb-3 flex h-8 w-8 items-center justify-center rounded-full border-[3px] font-mono text-[13px] font-semibold ${
                                isDoneStep
                                  ? "border-green bg-green text-white"
                                  : isCurrentStep
                                    ? "border-amber text-amber shadow-[0_0_0_5px_#FDF0DF]"
                                    : "border-[#D7E2E4] text-[#B7C4C8]"
                              }`}
                            >
                              {isDoneStep ? "✓" : i + 1}
                            </div>
                            <div
                              className={`font-poppins text-[13px] font-semibold ${
                                isDoneStep || isCurrentStep
                                  ? "text-ink"
                                  : "text-[#A9B7BD]"
                              }`}
                            >
                              {step.label.split("\n").map((line) => (
                                <span key={line} className="block">
                                  {line}
                                </span>
                              ))}
                            </div>
                            <div className="mt-1 text-[11.5px] text-muted">
                              {isDoneStep
                                ? "Done"
                                : isCurrentStep
                                  ? "In progress"
                                  : "Pending"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {isCancelled && (
                <div className="mt-6 rounded-xl bg-[#FBE7E7] px-5 py-4 text-sm text-red">
                  This request was cancelled. Please contact the clinic for
                  assistance.
                </div>
              )}

              {!isCancelled && (
                <div className="mt-7 rounded-xl border border-teal-border bg-teal-bg px-5 py-4 text-[13.5px] leading-relaxed text-[#2E5A5A]">
                  {isDone ? (
                    <span>
                      <strong>Your report is ready.</strong> You&apos;ll receive
                      an email with a secure download link — you can also
                      revisit this page anytime with the same key.
                    </span>
                  ) : (
                    <span>
                      You&apos;ll receive an email as soon as your report is
                      ready — you can also revisit this page anytime with the
                      same key.
                    </span>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}
