"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

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
      <section
        aria-busy="true"
        aria-live="polite"
        className="mx-auto max-w-2xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-kindly-border"
      >
        <p className="text-sm text-kindly-muted">Loading account settings…</p>
      </section>
    );
  }

  if (state === "guest") {
    return (
      <section className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-kindly-border sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Account deletion</h1>
        <p className="mt-3 text-sm text-kindly-muted">
          Sign in to request or manage account deletion.
        </p>
        <Link
          href="/sign-in"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-kindly-accent px-5 py-3 text-sm font-semibold text-white hover:bg-orange-800"
        >
          Sign in
        </Link>
      </section>
    );
  }

  if (state === "error") {
    return (
      <section className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-kindly-border sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Account deletion unavailable</h1>
        <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error ?? "Could not load account deletion details."}
        </p>
        <Link href="/me" className="mt-6 inline-block text-sm font-semibold text-kindly-accent">
          Back to My Space
        </Link>
      </section>
    );
  }

  const pending = request?.status === "REQUESTED";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="text-sm font-semibold tracking-wide text-kindly-accent uppercase">Account</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Account deletion</h1>
        <p className="mt-2 text-sm leading-6 text-kindly-muted">
          This records a deletion request only. No account or financial data is deleted now.
          Anonymisation waits for a counsel-approved retention policy; financial and audit records
          are preserved.
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {pending && request ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <h2 className="text-lg font-semibold">Deletion request received</h2>
          <p className="mt-2">
            Requested {formatDate(request.requestedAt)}. Your account is pending deletion and normal
            interactive actions are disabled. You can still cancel this request.
          </p>
          {request.reason && <p className="mt-2">Reason: {request.reason}</p>}
          <button
            type="button"
            disabled={busy}
            onClick={handleCancel}
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-kindly-border bg-white px-4 py-2 text-sm font-semibold hover:bg-kindly-accent-soft disabled:opacity-60"
          >
            {busy ? "Cancelling…" : "Cancel deletion request"}
          </button>
        </section>
      ) : (
        <form
          onSubmit={handleRequest}
          className="rounded-2xl border border-kindly-border bg-white p-5"
        >
          <h2 className="text-lg font-semibold">Request account deletion</h2>
          {request?.status === "CANCELLED" && (
            <p className="mt-2 rounded-xl bg-kindly-accent-soft p-3 text-sm">
              Your previous request was cancelled {formatDate(request.cancelledAt)}. You may request
              deletion again.
            </p>
          )}
          <p className="mt-2 text-sm leading-6 text-kindly-muted">
            Active wishes and unresolved gifts must be completed or withdrawn first. Withdrawing a
            wish starts the normal cooldown.
          </p>
          <div className="mt-4">
            <label htmlFor="deletion-reason" className="block text-sm font-medium">
              Reason (optional)
            </label>
            <textarea
              id="deletion-reason"
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-1 w-full rounded-xl border border-kindly-border px-3 py-2 text-sm"
              placeholder="Optional context for the operations team"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-kindly-accent px-5 py-3 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
          >
            {busy ? "Recording…" : "Request deletion"}
          </button>
        </form>
      )}

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/appeals" className="font-semibold text-kindly-accent underline">
          Moderation appeals
        </Link>
        <Link href="/me" className="font-semibold text-kindly-accent underline">
          My Space
        </Link>
      </div>
    </div>
  );
}
