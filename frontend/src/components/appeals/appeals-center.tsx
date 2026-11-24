"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import {
  listMyAppeals,
  listMyModerationActions,
  submitAppeal,
  type Appeal,
  type ModerationActionSummary,
} from "@/lib/api/appeals";
import { ApiError } from "@/lib/api/client";
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

function actionLabel(action: string): string {
  return action.charAt(0) + action.slice(1).toLowerCase();
}

function AppealForm({
  action,
  onSubmitted,
}: {
  action: ModerationActionSummary;
  onSubmitted: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (reason.trim().length < 10) {
      setError("Explain your appeal in at least 10 characters.");
      return;
    }
    setBusy(true);
    try {
      await submitAppeal(action.id, reason.trim());
      setReason("");
      setOpen(false);
      await onSubmitted();
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : "Could not submit the appeal. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!action.canAppeal) {
    return (
      <p className="mt-2 text-sm text-kindly-muted">
        {action.appealStatus
          ? `Appeal status: ${action.appealStatus.toLowerCase()}.`
          : "Warnings and reactivations are not appealable."}
      </p>
    );
  }

  return (
    <div className="mt-3">
      {open ? (
        <form onSubmit={handleSubmit} className="space-y-2">
          <label htmlFor={`appeal-reason-${action.id}`} className="block text-sm font-medium">
            Why should this be reviewed?
          </label>
          <textarea
            id={`appeal-reason-${action.id}`}
            required
            minLength={10}
            maxLength={1000}
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="w-full rounded-xl border border-kindly-border px-3 py-2 text-sm"
            placeholder="Share context the moderator should consider. Do not include your UPI ID, phone number or PIN."
          />
          {error && (
            <p role="alert" className="rounded-xl bg-red-50 p-2 text-red-700">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-kindly-accent px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
            >
              {busy ? "Submitting…" : "Submit appeal"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-kindly-border px-4 py-2 text-sm font-semibold hover:bg-kindly-accent-soft"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-kindly-border px-4 py-2 text-sm font-semibold hover:bg-kindly-accent-soft"
        >
          Appeal this action
        </button>
      )}
    </div>
  );
}

export function AppealsCenter() {
  const [state, setState] = useState<PageState>("loading");
  const [actions, setActions] = useState<ModerationActionSummary[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const [actionList, appealList] = await Promise.all([
      listMyModerationActions(),
      listMyAppeals(),
    ]);
    setActions(actionList);
    setAppeals(appealList);
  }

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
        await reload();
        if (!cancelled) {
          setState("ready");
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof ApiError
              ? loadError.message
              : "Could not load appeals. Try again.",
          );
          setState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return (
      <section
        aria-busy="true"
        aria-live="polite"
        className="mx-auto max-w-2xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-kindly-border"
      >
        <p className="text-sm text-kindly-muted">Loading moderation history…</p>
      </section>
    );
  }

  if (state === "guest") {
    return (
      <section className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-kindly-border sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Appeals</h1>
        <p className="mt-3 text-sm text-kindly-muted">
          Sign in to view moderation actions on your account and submit an appeal.
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
        <h1 className="text-2xl font-semibold tracking-tight">Appeals unavailable</h1>
        <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error ?? "Could not load appeals."}
        </p>
        <Link href="/" className="mt-6 inline-block text-sm font-semibold text-kindly-accent">
          Back to discovery
        </Link>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="text-sm font-semibold tracking-wide text-kindly-accent uppercase">
          Account review
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Appeals</h1>
        <p className="mt-2 text-sm leading-6 text-kindly-muted">
          Moderation reasons are private to you. An appeal is reviewed by an administrator; it does
          not automatically change your account status.
        </p>
      </header>

      <section aria-labelledby="moderation-actions-heading" className="space-y-3">
        <h2 id="moderation-actions-heading" className="text-lg font-semibold">
          Actions on your account
        </h2>
        {actions.length === 0 ? (
          <p className="rounded-2xl border border-kindly-border bg-white p-5 text-sm text-kindly-muted">
            No moderation actions on your account.
          </p>
        ) : (
          actions.map((action) => (
            <article
              key={action.id}
              className="rounded-2xl border border-kindly-border bg-white p-5 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{actionLabel(action.action)}</span>
                <span className="text-xs text-kindly-muted">{formatDate(action.createdAt)}</span>
              </div>
              <p className="mt-2">{action.reason}</p>
              <AppealForm action={action} onSubmitted={reload} />
            </article>
          ))
        )}
      </section>

      <section aria-labelledby="my-appeals-heading" className="space-y-3">
        <h2 id="my-appeals-heading" className="text-lg font-semibold">
          Your appeals
        </h2>
        {appeals.length === 0 ? (
          <p className="rounded-2xl border border-kindly-border bg-white p-5 text-sm text-kindly-muted">
            No appeals submitted.
          </p>
        ) : (
          appeals.map((appeal) => (
            <article
              key={appeal.id}
              className="rounded-2xl border border-kindly-border bg-white p-5 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{appeal.status}</span>
                <span className="text-xs text-kindly-muted">{formatDate(appeal.createdAt)}</span>
              </div>
              <p className="mt-2">{appeal.reason}</p>
              {appeal.resolutionNote && (
                <p className="mt-2 rounded-xl bg-green-50 p-3 text-green-900">
                  Resolution: {appeal.resolutionNote} ({formatDate(appeal.resolvedAt)})
                </p>
              )}
            </article>
          ))
        )}
      </section>

      <Link href="/" className="inline-block text-sm font-semibold text-kindly-accent underline">
        Back to discovery
      </Link>
    </div>
  );
}
