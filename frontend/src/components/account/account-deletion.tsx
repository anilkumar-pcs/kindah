"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { ApiError } from "@/lib/api/client";
import {
  cancelDeletion,
  getMyDeletionRequest,
  requestDeletion,
  type DeletionRequest,
} from "@/lib/api/deletion";
import { restoreSession } from "@/lib/auth/session";

type PageState = "loading" | "guest" | "ready" | "error";

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function AccountDeletion() {
  const [state, setState] = useState<PageState>("loading");
  const [request, setRequest] = useState<DeletionRequest | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    restoreSession()
      .then(async (session) => {
        if (cancelled) {
          return;
        }
        if (!session) {
          setState("guest");
          return;
        }
        try {
          const existing = await getMyDeletionRequest();
          if (!cancelled) {
            setRequest(existing);
          }
        } catch (loadError) {
          if (!(loadError instanceof ApiError && loadError.status === 404)) {
            throw loadError;
          }
        }
        if (!cancelled) {
          setState("ready");
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof ApiError
              ? loadError.message
              : "Could not load account deletion details.",
          );
          setState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setRequest(await requestDeletion(reason.trim() || undefined));
      setReason("");
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Could not record the deletion request.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    setBusy(true);
    setError(null);
    try {
      setRequest(await cancelDeletion());
    } catch (cancelError) {
      setError(
        cancelError instanceof ApiError
          ? cancelError.message
          : "Could not cancel the deletion request.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") {
    return (
      <section aria-busy="true" aria-live="polite" className="kindly-card mx-auto max-w-2xl p-6">
        <p className="text-sm text-kindly-muted">Loading account settings…</p>
      </section>
    );
  }

  if (state === "guest") {
    return (
      <section className="kindly-card mx-auto max-w-xl p-6 sm:p-8">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.055em]">
          Account deletion
        </h1>
        <p className="mt-3 text-sm text-kindly-muted">
          Sign in to request or manage account deletion.
        </p>
        <Link href="/sign-in" className="kindly-btn-primary mt-6">
          Sign in
        </Link>
      </section>
    );
  }

  if (state === "error") {
    return (
      <section className="kindly-card mx-auto max-w-xl p-6 sm:p-8">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.055em]">
          Account deletion unavailable
        </h1>
        <p role="alert" className="kindly-status-error mt-3">
          {error ?? "Could not load account deletion details."}
        </p>
        <Link href="/me" className="kindly-btn-quiet mt-4 !px-0">
          Back to My Space
        </Link>
      </section>
    );
  }

  const pending = request?.status === "REQUESTED";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Account deletion"
        description="This records a deletion request only. No account or financial data is deleted now. Anonymisation waits for a counsel-approved retention policy; financial and audit records are preserved."
      />

      {error && (
        <p role="alert" className="kindly-status-error">
          {error}
        </p>
      )}

      {pending && request ? (
        <section className="rounded-[1.5rem] border border-kindly-marigold/50 bg-kindly-marigold/20 p-5 text-sm text-kindly-ink">
          <h2 className="font-display text-2xl font-semibold tracking-[-0.04em]">
            Deletion request received
          </h2>
          <p className="mt-2">
            Requested {formatDate(request.requestedAt)}. Your account is pending deletion and normal
            interactive actions are disabled. You can still cancel this request.
          </p>
          {request.reason && <p className="mt-2">Reason: {request.reason}</p>}
          <button
            type="button"
            disabled={busy}
            onClick={handleCancel}
            className="kindly-btn-secondary mt-4"
          >
            {busy ? "Cancelling…" : "Cancel deletion request"}
          </button>
        </section>
      ) : (
        <form onSubmit={handleRequest} className="kindly-card p-5 sm:p-6">
          <h2 className="font-display text-2xl font-semibold tracking-[-0.04em]">
            Request account deletion
          </h2>
          {request?.status === "CANCELLED" && (
            <p className="kindly-card-soft mt-2 p-3 text-sm">
              Your previous request was cancelled {formatDate(request.cancelledAt)}. You may request
              deletion again.
            </p>
          )}
          <p className="mt-2 text-sm leading-6 text-kindly-muted">
            Active wishes and unresolved gifts must be completed or withdrawn first. Withdrawing a
            wish starts the normal cooldown.
          </p>
          <div className="mt-4">
            <label htmlFor="deletion-reason" className="kindly-label">
              Reason (optional)
            </label>
            <textarea
              id="deletion-reason"
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="kindly-input mt-1"
              placeholder="Optional context for the operations team"
            />
          </div>
          <button type="submit" disabled={busy} className="kindly-btn-primary mt-4">
            {busy ? "Recording…" : "Request deletion"}
          </button>
        </form>
      )}
    </div>
  );
}
