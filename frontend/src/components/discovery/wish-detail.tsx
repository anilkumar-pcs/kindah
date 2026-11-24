"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import { ApiError } from "@/lib/api/client";
import { getPublicWish, type PublicWish } from "@/lib/api/discovery";
import {
  blockWishOwner,
  reportWish,
  REPORT_REASON_LABELS,
  type ReportReason,
} from "@/lib/api/safety";
import type { WishMood } from "@/lib/api/wishes";
import { useSessionUser } from "@/lib/auth/use-session-user";

const MOOD_LABELS: Record<WishMood, string> = {
  CHAI_SNACK: "Chai & snack",
  JUST_BECAUSE: "Just because",
  LONG_DAY: "Long day",
  TINY_TREAT: "Tiny treat",
};

const MOOD_ICONS: Record<WishMood, IconName> = {
  CHAI_SNACK: "cup",
  JUST_BECAUSE: "sparkle",
  LONG_DAY: "cup",
  TINY_TREAT: "gift",
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
  });
}

export function WishDetail({ wishId }: { wishId: string }) {
  const { user } = useSessionUser();
  const [wish, setWish] = useState<PublicWish | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>("HARASSMENT_ABUSE");
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const [blockMessage, setBlockMessage] = useState<string | null>(null);
  const [safetyBusy, setSafetyBusy] = useState(false);
  const [safetyError, setSafetyError] = useState<string | null>(null);

  useEffect(() => {
    if (user === undefined) {
      return;
    }

    let cancelled = false;
    getPublicWish(wishId)
      .then((data) => {
        if (!cancelled) {
          setWish(data);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof ApiError && loadError.status === 404
              ? "This wish is unavailable or has expired."
              : "Could not load this wish.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [wishId, user]);

  async function handleReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSafetyBusy(true);
    setSafetyError(null);
    setNeedsAuth(false);
    try {
      await reportWish(wishId, reportReason);
      setReportMessage(
        "Report received. Reports are private. Three unique reports may temporarily hide a wish pending moderator review; this is not proof of wrongdoing.",
      );
      setReportOpen(false);
    } catch (reportError) {
      if (reportError instanceof ApiError && reportError.status === 401) {
        setNeedsAuth(true);
      } else {
        setSafetyError(
          reportError instanceof ApiError
            ? reportError.message
            : "Could not submit the report. Try again.",
        );
      }
    } finally {
      setSafetyBusy(false);
    }
  }

  async function handleBlock() {
    setSafetyBusy(true);
    setSafetyError(null);
    setNeedsAuth(false);
    try {
      await blockWishOwner(wishId);
      setBlockMessage(
        "You blocked this person. You will no longer see their wishes or interact with them.",
      );
    } catch (blockError) {
      if (blockError instanceof ApiError && blockError.status === 401) {
        setNeedsAuth(true);
      } else {
        setSafetyError(
          blockError instanceof ApiError
            ? blockError.message
            : "Could not block this person. Try again.",
        );
      }
    } finally {
      setSafetyBusy(false);
    }
  }

  if (loading) {
    return (
      <section aria-busy="true" aria-live="polite" className="mx-auto max-w-3xl">
        <div className="kindly-card p-6 sm:p-8">
          <div className="h-3 w-24 animate-pulse rounded-full bg-kindly-accent-soft" />
          <div className="mt-6 h-16 w-2/3 animate-pulse rounded-2xl bg-kindly-accent-soft/70" />
          <div className="mt-3 h-4 w-1/2 animate-pulse rounded-full bg-kindly-accent-soft/60" />
          <p className="mt-6 text-sm text-kindly-muted">Loading wish…</p>
        </div>
      </section>
    );
  }

  if (!wish) {
    return (
      <section className="kindly-card mx-auto max-w-xl p-8 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-kindly-accent-soft text-kindly-accent">
          <Icon name="cup" className="h-7 w-7" />
        </span>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-[-0.055em]">
          Wish unavailable
        </h1>
        <p role="alert" className="mt-3 text-sm leading-6 text-kindly-muted">
          {error ?? "This wish is no longer visible."}
        </p>
        <Link href="/" className="kindly-btn-primary mt-6">
          Back to discovery
        </Link>
      </section>
    );
  }

  const initial = wish.displayName.slice(0, 1).toUpperCase();
  const moodIcon = MOOD_ICONS[wish.mood];

  return (
    <article className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="kindly-btn-quiet !min-h-9 !px-2">
          <span aria-hidden="true">←</span> Back to discovery
        </Link>
        <span className="kindly-chip">
          <Icon name="sparkle" className="h-3 w-3" /> A little wish
        </span>
      </div>

      <header className="mt-5 flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-kindly-blush font-display text-base font-bold text-kindly-ink">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">
            {wish.displayName}
          </h1>
          <p className="mt-1 text-xs text-kindly-muted">
            {wish.city ? `${wish.city} · ` : ""}
            {formatDate(wish.createdAt)}
          </p>
        </div>
        <span className="kindly-chip">
          <Icon name={moodIcon} className="h-3 w-3" /> {MOOD_LABELS[wish.mood]}
        </span>
      </header>

      <section className="relative mt-5 overflow-hidden rounded-[2rem] bg-kindly-accent-soft p-6 sm:p-9">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -right-16 h-52 w-52 rounded-full bg-kindly-marigold/50 blur-2xl"
        />
        <p className="kindly-eyebrow relative">The little note</p>
        <p className="relative mt-3 max-w-2xl font-display text-3xl leading-[1.03] font-semibold tracking-[-0.055em] text-kindly-ink sm:text-4xl">
          {wish.message}
        </p>
        <div className="relative mt-8 flex flex-wrap items-end justify-between gap-3 border-t border-kindly-accent/15 pt-4">
          <span className="kindly-chip">
            <Icon name={moodIcon} className="h-3 w-3" /> {MOOD_LABELS[wish.mood]}
          </span>
          <span className="font-display text-2xl font-bold tracking-[-0.04em] text-kindly-coral">
            {wish.suggestedAmountInr ? (
              <>
                ₹{wish.suggestedAmountInr}{" "}
                <span className="font-sans text-[10px] font-semibold tracking-normal text-kindly-muted">
                  suggested
                </span>
              </>
            ) : (
              <span className="text-sm text-kindly-accent">You choose</span>
            )}
          </span>
        </div>
      </section>

      <div className="mt-4 flex items-start gap-2 rounded-2xl border border-kindly-border bg-kindly-card p-4 text-xs leading-5 text-kindly-muted">
        <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-kindly-accent" />
        <p>
          Kindly never holds your money. This gift is paid directly over UPI, and the
          recipient&apos;s phone number and UPI ID stay private.
        </p>
      </div>

      {error && (
        <p role="alert" className="kindly-status-error mt-4">
          {error}
        </p>
      )}

      {wish.isOwnWish ? (
        <section className="kindly-card mt-5 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-kindly-marigold/35 text-kindly-ink">
              <Icon name="heart" className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-xl font-semibold tracking-[-0.04em]">
                This is your wish.
              </p>
              <p className="mt-1 text-sm leading-6 text-kindly-muted">
                You cannot send a gift to yourself. Manage this wish, check its status, or withdraw
                it from My Space.
              </p>
            </div>
          </div>
          <Link href="/me" className="kindly-btn-primary mt-4">
            Manage in My Space
          </Link>
        </section>
      ) : (
        <section className="mt-5 rounded-[1.75rem] bg-kindly-accent p-5 text-white sm:p-6">
          <p className="text-[10px] font-extrabold tracking-[0.16em] text-kindly-accent-soft uppercase">
            Send a little lift
          </p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">
            You&apos;ll choose an amount from ₹10 to ₹100 next, then pay {wish.displayName} directly
            on UPI.
          </p>
          <div className="mt-4">
            <Link
              href={
                user
                  ? `/gifts/new/${wish.id}`
                  : `/sign-in?next=${encodeURIComponent(`/gifts/new/${wish.id}`)}`
              }
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-kindly-card px-5 py-3 text-sm font-bold text-kindly-accent shadow-[0_4px_0_rgb(0_0_0_/_12%)] hover:bg-kindly-cream sm:w-auto"
            >
              {user ? "Send a gift" : "Sign in to send a gift"}
              <Icon name="arrow-right" className="h-4 w-4" />
            </Link>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-white/65">
            <Icon name="shield" className="h-3.5 w-3.5" /> Direct UPI · no fees · no middleman
          </p>
        </section>
      )}

      {needsAuth && (
        <p role="alert" className="kindly-status-error mt-3">
          Your session expired.{" "}
          <Link href="/sign-in" className="font-semibold underline">
            Sign in again
          </Link>{" "}
          to report, block or send a gift.
        </p>
      )}

      {!wish.isOwnWish && (
        <section aria-labelledby="safety-heading" className="kindly-card mt-5 p-5 sm:p-6">
          <h2
            id="safety-heading"
            className="font-display text-2xl font-semibold tracking-[-0.04em]"
          >
            Report or block
          </h2>
          <p className="mt-1 text-sm leading-6 text-kindly-muted">
            Reports are private and never shown to the person you report. A temporary hide is not
            proof of wrongdoing.
          </p>
          {reportMessage && (
            <p aria-live="polite" className="kindly-status-success mt-3">
              {reportMessage}
            </p>
          )}
          {blockMessage && (
            <p aria-live="polite" className="kindly-status-success mt-3">
              {blockMessage}
            </p>
          )}
          {safetyError && (
            <p role="alert" className="kindly-status-error mt-3">
              {safetyError}
            </p>
          )}

          {!reportMessage && !blockMessage && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={safetyBusy}
                onClick={() => {
                  setReportOpen((current) => !current);
                  setSafetyError(null);
                }}
                className="kindly-btn-secondary !min-h-10 !px-4 !py-2"
              >
                Report this wish
              </button>
              <button
                type="button"
                disabled={safetyBusy}
                onClick={handleBlock}
                className="kindly-btn-secondary !min-h-10 !px-4 !py-2"
              >
                {safetyBusy ? "Working…" : "Block this person"}
              </button>
            </div>
          )}

          {reportOpen && !reportMessage && !blockMessage && (
            <form onSubmit={handleReport} className="mt-4 space-y-3">
              <div>
                <label htmlFor="report-reason" className="kindly-label">
                  Why are you reporting this wish?
                </label>
                <select
                  id="report-reason"
                  value={reportReason}
                  onChange={(event) => setReportReason(event.target.value as ReportReason)}
                  className="kindly-input mt-1"
                >
                  {(Object.keys(REPORT_REASON_LABELS) as ReportReason[]).map((value) => (
                    <option key={value} value={value}>
                      {REPORT_REASON_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={safetyBusy}
                  className="kindly-btn-primary !min-h-10 !px-4 !py-2"
                >
                  {safetyBusy ? "Sending…" : "Send report"}
                </button>
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  className="kindly-btn-secondary !min-h-10 !px-4 !py-2"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </article>
  );
}
