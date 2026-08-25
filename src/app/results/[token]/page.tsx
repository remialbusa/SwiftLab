"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Header from "@/components/Header";

interface DownloadFile {
  id: string;
  fileName: string;
  size: number;
  uploadedAt: string;
  signedUrl: string;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; files: DownloadFile[] };

export default function ResultsAccessPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/v1/results/${token}`);
        const json = (await res.json()) as {
          error?: string;
          files?: DownloadFile[];
        };
        if (!res.ok || !json.files) {
          if (!cancelled) {
            setState({
              status: "error",
              message: json.error ?? "Could not load your results.",
            });
          }
          return;
        }
        if (!cancelled) setState({ status: "ready", files: json.files });
      } catch {
        if (!cancelled) {
          setState({
            status: "error",
            message: "Network error. Please try again.",
          });
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-2xl px-4 py-10">
        <div className="card overflow-hidden">
          <div className="h-1.5 w-full bg-[repeating-linear-gradient(90deg,var(--green)_0_14px,transparent_14px_22px)]" />
          <div className="px-8 py-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="font-mono text-[11.5px] uppercase tracking-[1.5px] text-muted">
                  Laboratory Report
                </div>
                <h3 className="mt-1 font-poppins text-xl font-semibold text-navy-deep">
                  Your results
                </h3>
              </div>
              <span className="badge badge-done">Report Ready</span>
            </div>

            {state.status === "loading" && (
              <p className="mt-6 text-sm text-muted">Loading your results…</p>
            )}

            {state.status === "error" && (
              <div className="mt-6 rounded-xl border border-[#FBE7E7] bg-[#FBE7E7] px-5 py-4 text-sm text-red">
                {state.message}
              </div>
            )}

            {state.status === "ready" && (
              <>
                <div className="mt-6 rounded-xl border border-teal-border bg-teal-bg px-5 py-4 text-sm leading-relaxed text-[#2E5A5A]">
                  Your report(s) are ready to download. The PDFs are
                  password-protected — use your{" "}
                  <strong>last name + birth date (MMDDYYYY)</strong>, e.g.{" "}
                  <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">
                    delacruz05141990
                  </code>
                  .
                </div>

                <div className="mt-5 space-y-3">
                  {state.files.map((file) => (
                    <a
                      key={file.id}
                      href={file.signedUrl}
                      download={file.fileName}
                      className="flex items-center justify-between rounded-xl border border-[#e4eef0] bg-white p-4 transition hover:border-teal-border"
                    >
                      <span>
                        <span className="block text-sm font-medium text-ink">
                          {file.fileName}
                        </span>
                        <span className="block text-xs text-muted">
                          {(file.size / 1024).toFixed(0)} KB ·{" "}
                          {new Date(file.uploadedAt).toLocaleDateString()}
                        </span>
                      </span>
                      <span className="text-sm font-semibold text-green">
                        Download
                      </span>
                    </a>
                  ))}
                  {state.files.length === 0 && (
                    <p className="rounded-xl border border-[#e4eef0] bg-white p-6 text-sm text-muted">
                      No files are available yet.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
