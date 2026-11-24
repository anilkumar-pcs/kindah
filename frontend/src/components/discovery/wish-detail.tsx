"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { ApiError } from "@/lib/api/client";
import { getPublicWish, selectWish, type PublicWish } from "@/lib/api/discovery";
import {
  blockWishOwner,
  reportWish,
  REPORT_REASON_LABELS,
  type ReportReason,
} from "@/lib/api/safety";
import type { WishMood } from "@/lib/api/wishes";

const MOOD_LABELS: Record<WishMood, string> = {
  CHAI_SNACK: "Chai & snack",
  JUST_BECAUSE: "Just because",
  LONG_DAY: "Long day",
  TINY_TREAT: "Tiny treat",
};

export function WishDetail({ wishId }: { wishId: string }) {
  const [wish, setWish] = useState<PublicWish | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [selected, setSelected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>("HARASSMENT_ABUSE");
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const [blockMessage, setBlockMessage] = useState<string | null>(null);
  const [safetyBusy, setSafetyBusy] = useState(false);
  const [safetyError, setSafetyError] = useState<string | null>(null);

  useEffect(() => {
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
  }, [wishId]);

  async function handleSelect() {
    setBusy(true);
    setError(null);
    setNeedsAuth(false);
    try {
      await selectWish(wishId);
      setSelected(true);
    } catch (selectError) {
      if (selectError instanceof ApiError) {
        if (selectError.status === 401) {
          setNeedsAuth(true);
        } else {
          setError(selectError.message);
        }
      } else {
        setError("Could not select this wish.");
      }
    } finally {
      setBusy(false);
    }
  }

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
      <section
        aria-busy="true"
        aria-live="polite"
        className="mx-auto max-w-2xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-kindly-border"
      >
        <p className="text-sm text-kindly-muted">Loading wish…</p>
      </section>
    );
  }

  if (!wish) {
    return (
      <section className="mx-auto max-w-xl rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-kindly-border sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Wish unavailable</h1>
        <p role="alert" className="mt-3 text-sm leading-6 text-kindly-muted">
          {error ?? "This wish is no longer visible."}
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-kindly-accent px-5 py-3 text-sm font-semibold text-white hover:bg-orange-800"
        >
          Back to discovery
        </Link>
      </section>
    );
  }

  return (
    <article className="mx-auto max-w-2xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-kindly-border sm:p-8">
      <p className="text-sm font-semibold tracking-wide text-kindly-accent uppercase">Wish</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{wish.displayName}</h1>
      <p className="mt-1 text-sm text-kindly-muted">
        {wish.city ? `${wish.city} · ` : ""}
        {new Date(wish.createdAt).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "long",
        })}
      </p>

      <p className="mt-5 text-lg leading-8">{wish.message}</p>

      <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-xl bg-kindly-accent-soft p-4">
          <dt className="font-medium text-kindly-muted">Mood</dt>
          <dd className="mt-1 font-semibold">{MOOD_LABELS[wish.mood]}</dd>
        </div>
        <div className="rounded-xl bg-kindly-accent-soft p-4">
          <dt className="font-medium text-kindly-muted">Amount</dt>
          <dd className="mt-1 font-semibold">
            {wish.suggestedAmountInr
              ? `₹${wish.suggestedAmountInr} suggested`
              : "You choose between ₹10 and ₹100"}
          </dd>
        </div>
      </dl>

      <p className="mt-5 rounded-xl border border-kindly-border p-4 text-sm text-kindly-muted">
        Kindly does not hold your money. A gift is paid directly over UPI, and the recipient&apos;s
        phone number and UPI ID are never shown publicly.
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <section aria-labelledby="safety-heading" className="mt-6 border-t border-kindly-border pt-5">
        <h2 id="safety-heading" className="text-lg font-semibold">
          Report or block
        </h2>
        <p className="mt-1 text-sm leading-6 text-kindly-muted">
          Reports are private and never shown to the person you report. A temporary hide is not
          proof of wrongdoing.
        </p>
        {reportMessage && (
          <p aria-live="polite" className="mt-3 rounded-xl bg-green-50 p-3 text-sm text-green-900">
            {reportMessage}
          </p>
        )}
        {blockMessage && (
          <p aria-live="polite" className="mt-3 rounded-xl bg-green-50 p-3 text-sm text-green-900">
            {blockMessage}
          </p>
        )}
        {safetyError && (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
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
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-kindly-border px-4 py-2 text-sm font-semibold hover:bg-kindly-accent-soft disabled:opacity-60"
            >
              Report this wish
            </button>
            <button
              type="button"
              disabled={safetyBusy}
              onClick={handleBlock}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-kindly-border px-4 py-2 text-sm font-semibold hover:bg-kindly-accent-soft disabled:opacity-60"
            >
              {safetyBusy ? "Working…" : "Block this person"}
            </button>
          </div>
        )}

        {reportOpen && !reportMessage && !blockMessage && (
          <form onSubmit={handleReport} className="mt-4 space-y-3">
            <div>
              <label htmlFor="report-reason" className="block text-sm font-medium">
                Why are you reporting this wish?
              </label>
              <select
                id="report-reason"
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value as ReportReason)}
                className="mt-1 min-h-11 w-full rounded-xl border border-kindly-border bg-white px-3 py-2 text-sm"
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
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-kindly-accent px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
              >
                {safetyBusy ? "Sending…" : "Send report"}
              </button>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-kindly-border px-4 py-2 text-sm font-semibold hover:bg-kindly-accent-soft"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>

      {selected ? (
        <div className="mt-6 rounded-xl bg-green-50 p-4 text-sm text-green-800">
          <p className="font-semibold">Wish selected.</p>
          <p className="mt-1">Choose a whole-rupee amount between ₹10 and ₹100.</p>
          <Link
            href={`/gifts/new/${wish.id}`}
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-kindly-accent px-5 py-3 font-semibold text-white hover:bg-orange-800"
          >
            Choose amount
          </Link>
        </div>
      ) : needsAuth ? (
        <div className="mt-6 rounded-xl border border-kindly-border p-4 text-sm">
          <p>Sign in before selecting, reporting or blocking.</p>
          <Link
            href="/sign-in"
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-kindly-accent px-5 py-3 font-semibold text-white hover:bg-orange-800"
          >
            Sign in to continue
          </Link>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleSelect}
          disabled={busy}
          className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-kindly-accent px-5 py-3 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
        >
          {busy ? "Selecting…" : "Select this wish"}
        </button>
      )}

      <Link
        href="/"
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl px-2 py-2 text-sm font-semibold text-kindly-accent underline"
      >
        Back to discovery
      </Link>
    </article>
  );
}
