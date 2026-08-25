"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

interface OrderDetail {
  id: string;
  status: string;
  createdAt: string;
  walkIn: boolean;
  patient: {
    full_name: string;
    last_name: string;
    dob: string;
    sex: string | null;
    email: string;
    phone: string | null;
  };
  tests: { id: string; name: string; code: string; cash_price: number }[];
  payments: { method: string; amount: number; confirmed_at: string }[];
  results: {
    id: string;
    file_name: string;
    file_size: number;
    uploaded_at: string;
  }[];
  appointment: { slot_start: string; slot_end: string; status: string } | null;
}

const STATUS_OPTIONS = [
  "pre_registered",
  "payment_confirmed",
  "sample_processing",
  "results_ready",
  "cancelled",
] as const;

const STATUS_LABELS: Record<string, string> = {
  pre_registered: "Pre-registered",
  payment_confirmed: "Payment confirmed",
  sample_processing: "Sample processing",
  results_ready: "Results ready",
  cancelled: "Cancelled",
};

const SEX_LABELS: Record<string, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
  prefer_not_to_say: "Prefer not to say",
};

/** Compute age in years from a YYYY-MM-DD birth date, or null if invalid. */
function computeAge(birthDate: string): number | null {
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; order: OrderDetail };

type ModalState =
  | { kind: "none" }
  | {
      kind: "payment";
      amount: string;
      submitting: boolean;
      error: string | null;
    }
  | {
      kind: "status";
      target: string;
      submitting: boolean;
      error: string | null;
    };

export default function StaffOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [uploadState, setUploadState] = useState<
    | { status: "idle" }
    | { status: "uploading" }
    | { status: "error"; message: string }
  >({ status: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadOrder = async () => {
    const res = await fetch(`/api/v1/staff/orders/${orderId}`);
    if (!res.ok) {
      setState({ status: "error", message: "Could not load order." });
      return;
    }
    const json = (await res.json()) as { order: OrderDetail };
    setState({ status: "ready", order: json.order });
  };

  useEffect(() => {
    void loadOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const changeStatus = async (status: string) => {
    setModal({
      kind: "status",
      target: status,
      submitting: false,
      error: null,
    });
  };

  const submitStatusChange = async () => {
    if (modal.kind !== "status") return;
    const target = modal.target;
    setModal({ ...modal, submitting: true });
    const res = await fetch(`/api/v1/staff/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: target }),
    });
    if (!res.ok) {
      setModal({
        kind: "status",
        target,
        submitting: false,
        error: "Could not update status.",
      });
      return;
    }
    setModal({ kind: "none" });
    await loadOrder();
  };

  const openPaymentModal = () => {
    if (!state.status || state.status !== "ready") return;
    const total = state.order.tests.reduce(
      (sum, t) => sum + Number(t.cash_price),
      0,
    );
    setModal({
      kind: "payment",
      amount: String(total || ""),
      submitting: false,
      error: null,
    });
  };

  const submitPayment = async () => {
    if (modal.kind !== "payment") return;
    const num = Number(modal.amount);
    if (Number.isNaN(num) || num <= 0) {
      setModal({ ...modal, error: "Enter an amount greater than zero." });
      return;
    }
    setModal({ ...modal, submitting: true });
    const res = await fetch(`/api/v1/staff/orders/${orderId}/confirm-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "in_person", amount: num }),
    });
    if (!res.ok) {
      setModal({
        kind: "payment",
        amount: modal.amount,
        submitting: false,
        error: "Could not confirm payment.",
      });
      return;
    }
    setModal({ kind: "none" });
    await loadOrder();
  };

  const uploadPdf = async (file: File) => {
    setUploadState({ status: "uploading" });
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`/api/v1/staff/orders/${orderId}/results`, {
      method: "POST",
      body,
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setUploadState({
        status: "error",
        message: json?.error ?? "Upload failed.",
      });
      return;
    }
    setUploadState({ status: "idle" });
    await loadOrder();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files[0];
    if (file) void uploadPdf(file);
  };

  if (state.status === "loading") {
    return <p className="text-sm text-slate-400">Loading order…</p>;
  }
  if (state.status === "error") {
    return <p className="text-sm text-red-600">{state.message}</p>;
  }

  const { order } = state;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">
          Order {order.id.slice(0, 8)}
        </h1>
        <span className="rounded-full bg-teal-100 px-3 py-1 text-sm font-semibold text-teal-800">
          {STATUS_LABELS[order.status] ?? order.status}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Patient + tests */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-700">Patient</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Name</dt>
              <dd className="font-medium text-slate-800">
                {order.patient.full_name}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Birth date</dt>
              <dd className="font-medium text-slate-800">
                {order.patient.dob}
                {computeAge(order.patient.dob) !== null && (
                  <span className="ml-1 text-xs text-slate-400">
                    ({computeAge(order.patient.dob)} yrs)
                  </span>
                )}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Sex / Gender</dt>
              <dd className="font-medium text-slate-800">
                {order.patient.sex
                  ? (SEX_LABELS[order.patient.sex] ?? order.patient.sex)
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Email</dt>
              <dd className="font-medium text-slate-800">
                {order.patient.email}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Phone</dt>
              <dd className="font-medium text-slate-800">
                {order.patient.phone ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Type</dt>
              <dd className="font-medium text-slate-800">
                {order.walkIn ? "Walk-in" : "Online"}
              </dd>
            </div>
          </dl>

          <h2 className="mt-5 text-sm font-semibold text-slate-700">Tests</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {order.tests.map((test) => (
              <li key={test.id} className="flex justify-between">
                <span>{test.name}</span>
                <span className="font-medium text-slate-800">
                  ₱{Number(test.cash_price).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>

          {order.appointment && (
            <>
              <h2 className="mt-5 text-sm font-semibold text-slate-700">
                Appointment
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {order.appointment.slot_start}–{order.appointment.slot_end} ·{" "}
                {order.appointment.status}
              </p>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-700">Progress</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {STATUS_OPTIONS.filter((s) => s !== order.status).map((s) => (
                <button
                  key={s}
                  onClick={() => void changeStatus(s)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
            {order.status === "pre_registered" && (
              <button
                onClick={() => openPaymentModal()}
                className="mt-3 w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                Confirm payment
              </button>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-700">
              Upload results (PDF)
            </h2>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`mt-3 cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition ${
                dragOver
                  ? "border-teal-500 bg-teal-50"
                  : "border-slate-300 hover:border-teal-400"
              }`}
            >
              <p className="text-sm text-slate-600">
                Drag &amp; drop a PDF here, or
              </p>
              <p className="mt-1 text-sm font-semibold text-teal-700">
                click to browse files
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadPdf(file);
                  e.target.value = "";
                }}
              />
            </div>
            {uploadState.status === "uploading" && (
              <p className="mt-2 text-sm text-slate-500">
                Encrypting &amp; uploading…
              </p>
            )}
            {uploadState.status === "error" && (
              <p className="mt-2 text-sm font-medium text-red-600">
                {uploadState.message}
              </p>
            )}

            <h3 className="mt-4 text-xs font-semibold uppercase text-slate-400">
              Uploaded results
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              {order.results.map((result) => (
                <li key={result.id} className="flex justify-between">
                  <span>{result.file_name}</span>
                  <span className="text-xs text-slate-400">
                    {new Date(result.uploaded_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
              {order.results.length === 0 && (
                <li className="text-slate-400">No results yet.</li>
              )}
            </ul>
          </div>

          {order.payments.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-700">Payments</h2>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {order.payments.map((payment, index) => (
                  <li key={index} className="flex justify-between">
                    <span>{payment.method}</span>
                    <span className="font-medium text-slate-800">
                      ₱{Number(payment.amount).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {modal.kind !== "none" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={
            modal.kind === "payment" ? "Confirm payment" : "Change status"
          }
          onClick={() => {
            if (!modal.submitting) setModal({ kind: "none" });
          }}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {modal.kind === "payment" ? (
              <>
                <h2 className="text-lg font-bold text-slate-900">
                  Confirm payment
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Record the amount collected for this order.
                </p>
                <label className="mt-4 block text-sm font-medium text-slate-700">
                  Amount (₱)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  autoFocus
                  value={modal.amount}
                  onChange={(e) =>
                    setModal({ ...modal, amount: e.target.value, error: null })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                {modal.error && (
                  <p className="mt-2 text-sm font-medium text-red-600">
                    {modal.error}
                  </p>
                )}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => void submitPayment()}
                    disabled={modal.submitting}
                    className="flex-1 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {modal.submitting ? "Confirming…" : "Confirm payment"}
                  </button>
                  <button
                    onClick={() => setModal({ kind: "none" })}
                    disabled={modal.submitting}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold text-slate-900">
                  Change status
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Set this order to{" "}
                  <span className="font-semibold text-slate-800">
                    {STATUS_LABELS[modal.target] ?? modal.target}
                  </span>
                  ?
                </p>
                {modal.error && (
                  <p className="mt-2 text-sm font-medium text-red-600">
                    {modal.error}
                  </p>
                )}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => void submitStatusChange()}
                    disabled={modal.submitting}
                    className="flex-1 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                  >
                    {modal.submitting ? "Updating…" : "Update status"}
                  </button>
                  <button
                    onClick={() => setModal({ kind: "none" })}
                    disabled={modal.submitting}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
