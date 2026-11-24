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
import { PageHeader } from "@/components/ui/page-header";
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
          <label htmlFor={`appeal-reason-${action.id}`} className="kindly-label">
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
            className="kindly-input mt-1"
            placeholder="Share context the moderator should consider. Do not include your UPI ID, phone number or PIN."
          />
          {error && (
            <p role="alert" className="kindly-status-error">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className="kindly-btn-primary">
              {busy ? "Submitting…" : "Submit appeal"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="kindly-btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="kindly-btn-secondary">
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
      <section aria-busy="true" aria-live="polite" className="kindly-card mx-auto max-w-2xl p-6">
        <p className="text-sm text-kindly-muted">Loading moderation history…</p>
      </section>
    );
  }

  if (state === "guest") {
    return (
      <section className="kindly-card mx-auto max-w-xl p-6 sm:p-8">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.055em]">Appeals</h1>
        <p className="mt-3 text-sm text-kindly-muted">
          Sign in to view moderation actions on your account and submit an appeal.
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
          Appeals unavailable
        </h1>
        <p role="alert" className="kindly-status-error mt-3">
          {error ?? "Could not load appeals."}
        </p>
        <Link href="/" className="kindly-btn-quiet mt-4 !px-0">
          Back to discovery
        </Link>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        eyebrow="Account review"
        title="Appeals"
        description="Moderation reasons are private to you. An appeal is reviewed by an administrator; it does not automatically change your account status."
      />

      <section aria-labelledby="moderation-actions-heading" className="space-y-3">
        <h2
          id="moderation-actions-heading"
          className="font-display text-2xl font-semibold tracking-[-0.04em]"
        >
          Actions on your account
        </h2>
        {actions.length === 0 ? (
          <p className="kindly-card p-5 text-sm text-kindly-muted">
            No moderation actions on your account.
          </p>
        ) : (
          actions.map((action) => (
            <article key={action.id} className="kindly-card p-5 text-sm">
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
        <h2
          id="my-appeals-heading"
          className="font-display text-2xl font-semibold tracking-[-0.04em]"
        >
          Your appeals
        </h2>
        {appeals.length === 0 ? (
          <p className="kindly-card p-5 text-sm text-kindly-muted">No appeals submitted.</p>
        ) : (
          appeals.map((appeal) => (
            <article key={appeal.id} className="kindly-card p-5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{appeal.status}</span>
                <span className="text-xs text-kindly-muted">{formatDate(appeal.createdAt)}</span>
              </div>
              <p className="mt-2">{appeal.reason}</p>
              {appeal.resolutionNote && (
                <p className="kindly-status-success mt-2">
                  Resolution: {appeal.resolutionNote} ({formatDate(appeal.resolvedAt)})
                </p>
              )}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
