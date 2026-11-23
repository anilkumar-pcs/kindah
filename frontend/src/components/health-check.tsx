"use client";

import { useEffect, useState } from "react";

import { ApiError, apiFetch } from "@/lib/api/client";

type MetaResponse = {
  service: string;
  version: string;
  environment: string;
};

type CheckState =
  | { status: "loading" }
  | { status: "ok"; meta: MetaResponse }
  | { status: "error"; message: string };

export function HealthCheck() {
  const [state, setState] = useState<CheckState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    apiFetch<MetaResponse>("/api/v1/meta")
      .then((meta) => {
        if (!cancelled) {
          setState({ status: "ok", meta });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof ApiError ? error.message : "The service check failed.";
          setState({ status: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      aria-labelledby="service-status"
      className="rounded-2xl border border-kindly-border bg-white p-5"
    >
      <h2 id="service-status" className="text-sm font-semibold">
        Service status
      </h2>
      <div role="status" aria-live="polite" className="mt-2 text-sm text-kindly-muted">
        {state.status === "loading" && <p>Checking the Kindly service…</p>}
        {state.status === "ok" && (
          <p>
            Service online — {state.meta.service} v{state.meta.version} ({state.meta.environment}).
          </p>
        )}
        {state.status === "error" && (
          <p className="text-red-700">Service check failed: {state.message}</p>
        )}
      </div>
    </section>
  );
}
