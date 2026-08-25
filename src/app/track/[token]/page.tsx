import { notFound } from "next/navigation";
import { getServiceClient } from "@/lib/supabase/server";
import { hashToken } from "@/lib/token";
import { writeAuditLog } from "@/lib/audit";
import type { OrderSummary } from "@/lib/orders";
import Header from "@/components/Header";

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

/** Steps shown on the tracker. Each maps to an order-status milestone. */
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

/** True when the ISO timestamp is in the past. */
function isExpired(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

export default async function TrackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const client = getServiceClient();
  const hash = hashToken(token);

  const { data: link } = await client
    .from("magic_links")
    .select("order_id, purpose, expires_at, used_at, revoked_at")
    .eq("token_hash", hash)
    .maybeSingle();

  if (!link || link.purpose !== "tracking") notFound();
  if (link.expires_at && isExpired(link.expires_at as string)) notFound();
  if (link.used_at || link.revoked_at) notFound();

  const { data: order } = await client
    .from("orders")
    .select("id, status, created_at")
    .eq("id", link.order_id)
    .maybeSingle();
  if (!order) notFound();

  const { data: orderTests } = await client
    .from("order_tests")
    .select("lab_tests(name)")
    .eq("order_id", order.id);
  const { data: appointment } = await client
    .from("appointments")
    .select("slot_start, slot_end, status")
    .eq("order_id", order.id)
    .maybeSingle();

  // The tracking page doesn't expose a download; results arrive by email.
  void writeAuditLog({
    actorType: "patient",
    action: "tracking.viewed",
    resourceType: "order",
    resourceId: order.id,
    metadata: { via: "tracking-link" },
  });

  const summary: OrderSummary = {
    id: order.id,
    status: order.status,
    createdAt: order.created_at,
    tests: (orderTests ?? []).map(
      (t) => (t.lab_tests as { name?: string } | null)?.name ?? "Unknown",
    ),
    appointment: appointment
      ? {
          slotStart: appointment.slot_start as string,
          slotEnd: appointment.slot_end as string,
          status: appointment.status as string,
        }
      : null,
  };

  const currentIdx = statusIndex(summary.status);
  const isCancelled = summary.status === "cancelled";
  const isDone = summary.status === "results_ready";

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <div className="card px-8 py-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-dashed border-[#DCE7E9] pb-6">
            <div>
              <div className="font-mono text-[11.5px] uppercase tracking-[1.5px] text-muted">
                Request Key · {summary.id.slice(0, 8)}
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
                  <strong>Your report is ready.</strong> You&apos;ll receive an
                  email with a secure download link — you can also revisit this
                  page anytime with the same key.
                </span>
              ) : (
                <span>
                  You&apos;ll receive an email as soon as your report is ready —
                  you can also revisit this page anytime with the same key.
                </span>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
