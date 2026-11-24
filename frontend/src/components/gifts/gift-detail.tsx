"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { GiftHandoff } from "@/components/gifts/gift-handoff";
import { ApiError } from "@/lib/api/client";
import {
  confirmRecipientOutcome,
  createSupportCase,
  getGift,
  getShareCard,
  newIdempotencyKey,
  type Gift,
  type Reaction,
  type RecipientOutcome,
  type ShareCard,
  type SupportCase,
  type SupportCaseType,
} from "@/lib/api/gifts";
import { giftStatusLabel, giftStatusTone, SUPPORT_CASE_LABELS } from "@/lib/gifts/labels";
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

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return "Something went wrong. Try again.";
}

function RecipientConfirmation({
  gift,
  onUpdated,
}: {
  gift: Gift;
  onUpdated: (gift: Gift) => void;
}) {
  const [reaction, setReaction] = useState<"" | Reaction>("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<RecipientOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const attemptRef = useRef<{ outcome: RecipientOutcome; key: string } | null>(null);

  async function handleConfirm(outcome: RecipientOutcome) {
    setBusy(outcome);
    setError(null);
    if (!attemptRef.current || attemptRef.current.outcome !== outcome) {
      attemptRef.current = { outcome, key: newIdempotencyKey() };
    }
    try {
      const updated = await confirmRecipientOutcome(
        gift.giftId,
        {
          outcome,
          ...(outcome === "RECEIVED" && reaction ? { reaction } : {}),
          ...(outcome === "RECEIVED" && message.trim() ? { message: message.trim() } : {}),
        },
        attemptRef.current.key,
      );
      attemptRef.current = null;
      onUpdated(updated);
    } catch (confirmError) {
      setError(errorMessage(confirmError));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="recipient-confirmation-heading" className="kindly-card p-5 sm:p-6">
      <p className="text-xs font-semibold tracking-wide text-kindly-accent uppercase">
        Donor says paid
      </p>
      <h2
        id="recipient-confirmation-heading"
        className="mt-1 font-display text-2xl font-semibold tracking-[-0.04em]"
      >
        Did you receive this gift?
      </h2>
      <p className="mt-2 text-sm leading-6 text-kindly-muted">
        The donor has told us they paid ₹{gift.amountInr}. This is not bank verification. Confirm
        only after checking your own UPI app or bank account. You have until{" "}
        {formatDate(gift.recipientResponseDeadline)} to respond.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="gift-reaction" className="kindly-label">
            Reaction (optional)
          </label>
          <select
            id="gift-reaction"
            value={reaction}
            onChange={(event) => setReaction(event.target.value as "" | Reaction)}
            className="kindly-input mt-1"
          >
            <option value="">No reaction</option>
            <option value="HEART">Heart</option>
            <option value="PRAY">Pray</option>
            <option value="SMILE">Smile</option>
          </select>
        </div>
        <div>
          <label htmlFor="gift-thanks" className="kindly-label">
            Thank-you note (optional)
          </label>
          <input
            id="gift-thanks"
            type="text"
            maxLength={120}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="kindly-input mt-1"
            placeholder="Say thanks or share a smile"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="kindly-status-error mt-3">
          {error}
        </p>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => handleConfirm("RECEIVED")}
          className="kindly-btn-primary"
        >
          {busy === "RECEIVED" ? "Confirming…" : "Yes, I received it"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => handleConfirm("NOT_RECEIVED")}
          className="kindly-btn-secondary"
        >
          {busy === "NOT_RECEIVED" ? "Recording…" : "No, I did not receive it"}
        </button>
      </div>
    </section>
  );
}

function SupportPanel({ gift }: { gift: Gift }) {
  const [open, setOpen] = useState(false);
  const [caseType, setCaseType] = useState<SupportCaseType>(
    gift.viewerRole === "DONOR" ? "LATE_PAYMENT" : "RECIPIENT_DISPUTE",
  );
  const [description, setDescription] = useState("");
  const [supportCase, setSupportCase] = useState<SupportCase | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (description.trim().length < 10) {
      setError("Describe the problem in at least 10 characters.");
      return;
    }
    setBusy(true);
    try {
      const created = await createSupportCase(gift.giftId, {
        caseType,
        description: description.trim(),
      });
      setSupportCase(created);
      setDescription("");
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="support-heading" className="kindly-card p-5 sm:p-6">
      <h2 id="support-heading" className="font-display text-2xl font-semibold tracking-[-0.04em]">
        Something went wrong?
      </h2>
      <p className="mt-1 text-sm leading-6 text-kindly-muted">
        Late payments and missing gifts are handled by support. Kindly cannot reverse or refund a
        UPI payment. Contact your bank or UPI provider for payment disputes.
      </p>

      {supportCase ? (
        <div aria-live="polite" className="kindly-status-success mt-4">
          <p className="font-semibold">Support case {supportCase.status}.</p>
          <p className="mt-1">
            An administrator can review the gift and your report. Keep the case reference{" "}
            <span className="font-mono">{supportCase.id.slice(0, 8)}</span>.
          </p>
        </div>
      ) : open ? (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="support-case-type" className="kindly-label">
              What happened?
            </label>
            <select
              id="support-case-type"
              value={caseType}
              onChange={(event) => setCaseType(event.target.value as SupportCaseType)}
              className="kindly-input mt-1"
            >
              {(Object.keys(SUPPORT_CASE_LABELS) as SupportCaseType[]).map((value) => (
                <option key={value} value={value}>
                  {SUPPORT_CASE_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="support-description" className="kindly-label">
              Tell us what happened
            </label>
            <textarea
              id="support-description"
              required
              minLength={10}
              maxLength={1000}
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="kindly-input mt-1"
              aria-describedby="support-description-help"
              placeholder="Include what you saw in your UPI app or bank account. Do not include your UPI ID or phone number."
            />
            <p id="support-description-help" className="mt-1 text-xs text-kindly-muted">
              {description.length}/1000 characters. Never include your UPI ID, phone number or PIN.
            </p>
          </div>
          {error && (
            <p role="alert" className="kindly-status-error">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className="kindly-btn-primary">
              {busy ? "Sending…" : "Send to support"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              className="kindly-btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-kindly-border px-5 py-3 text-sm font-semibold hover:bg-kindly-accent-soft"
        >
          Report a problem
        </button>
      )}
    </section>
  );
}

export function GiftDetail({ giftId }: { giftId: string }) {
  const [pageState, setPageState] = useState<PageState>("loading");
  const [gift, setGift] = useState<Gift | null>(null);
  const [shareCard, setShareCard] = useState<ShareCard | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    restoreSession()
      .then(async (session) => {
        if (cancelled) {
          return;
        }
        if (!session) {
          setPageState("guest");
          return;
        }
        const loadedGift = await getGift(giftId);
        if (!cancelled) {
          setGift(loadedGift);
          setPageState("ready");
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof ApiError && loadError.status === 404
              ? "This gift is unavailable, or you are not a participant."
              : errorMessage(loadError),
          );
          setPageState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [giftId]);

  async function handleShareCard() {
    setShareBusy(true);
    setShareError(null);
    try {
      setShareCard(await getShareCard(giftId));
    } catch (shareLoadError) {
      setShareError(errorMessage(shareLoadError));
    } finally {
      setShareBusy(false);
    }
  }

  if (pageState === "loading") {
    return (
      <section aria-busy="true" aria-live="polite" className="kindly-card mx-auto max-w-2xl p-6">
        <p className="text-sm text-kindly-muted">Loading gift…</p>
      </section>
    );
  }

  if (pageState === "guest") {
    return (
      <section className="kindly-card mx-auto max-w-xl p-6 sm:p-8">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.055em]">
          Sign in to view this gift
        </h1>
        <p className="mt-3 text-sm leading-6 text-kindly-muted">
          Gift details are visible only to the donor and recipient.
        </p>
        <Link href="/sign-in" className="kindly-btn-primary mt-6">
          Sign in
        </Link>
      </section>
    );
  }

  if (pageState === "error" || !gift) {
    return (
      <section className="kindly-card mx-auto max-w-xl p-6 sm:p-8">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.055em]">
          Gift unavailable
        </h1>
        <p role="alert" className="kindly-status-error mt-3">
          {error ?? "This gift could not be loaded."}
        </p>
        <Link href="/" className="kindly-btn-primary mt-6">
          Back to discovery
        </Link>
      </section>
    );
  }

  const isRecipient = gift.viewerRole === "RECIPIENT";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="kindly-card p-5 sm:p-6">
        <div
          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${giftStatusTone(gift.giftStatus)}`}
        >
          {giftStatusLabel(gift.giftStatus)}
        </div>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">
          {isRecipient
            ? "A gift from a kind donor"
            : `Gift to ${gift.recipientDisplayName ?? "the recipient"}`}
        </h1>
        <p className="mt-1 text-3xl font-semibold">₹{gift.amountInr}</p>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-kindly-muted">Reference</dt>
            <dd className="font-mono font-semibold">{gift.paymentRefCode}</dd>
          </div>
          <div>
            <dt className="text-kindly-muted">Started</dt>
            <dd>{formatDate(gift.createdAt)}</dd>
          </div>
        </dl>

        {gift.giftStatus === "DONOR_CLAIMED_PAID" && (
          <p className="kindly-card-soft mt-4 p-3 text-sm">
            Donor says paid. Awaiting recipient confirmation.
          </p>
        )}
        {isRecipient &&
          (gift.giftStatus === "HANDOFF_ISSUED" || gift.giftStatus === "DONOR_PENDING") && (
            <p className="kindly-card-soft mt-4 p-3 text-sm">
              The donor is completing a direct UPI payment. You will be asked to confirm only after
              they say they have paid.
            </p>
          )}
        {gift.giftStatus === "RECIPIENT_CONFIRMED" && (
          <div className="kindly-status-success mt-4">
            <p>Recipient confirmed this gift. No further payment action is needed.</p>
            {(gift.reaction || gift.thankYouMessage) && (
              <p className="mt-2">
                {gift.reaction === "HEART" && "❤️ "}
                {gift.reaction === "PRAY" && "🙏 "}
                {gift.reaction === "SMILE" && "😊 "}
                {gift.thankYouMessage ?? ""}
              </p>
            )}
          </div>
        )}
        {gift.giftStatus === "DISPUTED" && (
          <p className="mt-4 rounded-2xl border border-kindly-marigold/50 bg-kindly-marigold/20 p-3 text-sm text-kindly-ink">
            The recipient has disputed receipt. Support can review the case; Kindly cannot reverse
            the UPI payment.
          </p>
        )}
        {gift.giftStatus === "UNVERIFIED" && (
          <p className="mt-4 rounded-2xl border border-kindly-marigold/50 bg-kindly-marigold/20 p-3 text-sm text-kindly-ink">
            The recipient did not confirm in time. This gift is unverified. Support can review a
            report; there is no automatic reopening, refund or reassignment.
          </p>
        )}
        {gift.giftStatus === "FAILED" && (
          <p className="mt-4 rounded-2xl border border-kindly-marigold/50 bg-kindly-marigold/20 p-3 text-sm text-kindly-ink">
            No payment was recorded and the wish was released. You can return to discovery for
            another wish.
          </p>
        )}
        {(gift.giftStatus === "ABANDONED" || gift.giftStatus === "CANCELLED") && (
          <p className="kindly-card-soft mt-4 p-3 text-sm text-kindly-muted">
            This handoff is closed. No automatic reopening or reassignment is available.
          </p>
        )}
      </header>

      {gift.giftStatus === "RECIPIENT_CONFIRMED" && (
        <section className="kindly-card p-5 sm:p-6">
          <h2 className="font-display text-2xl font-semibold tracking-[-0.04em]">
            Share this kindness
          </h2>
          <p className="mt-1 text-sm text-kindly-muted">
            The share card never includes the donor identity, UPI ID, phone, UTR or payment link.
          </p>
          {shareCard ? (
            <div className="kindly-card-soft mt-3 p-4 text-sm">
              <p>{shareCard.shareText}</p>
              <button
                type="button"
                onClick={() => {
                  if (navigator.clipboard) {
                    void navigator.clipboard.writeText(shareCard.shareText);
                  }
                }}
                className="kindly-btn-secondary mt-3"
              >
                Copy share text
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={shareBusy}
              onClick={handleShareCard}
              className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl border border-kindly-border px-4 py-2 text-sm font-semibold hover:bg-kindly-accent-soft disabled:opacity-60"
            >
              {shareBusy ? "Preparing…" : "Create share card"}
            </button>
          )}
          {shareError && (
            <p role="alert" className="kindly-status-error mt-3">
              {shareError}
            </p>
          )}
        </section>
      )}

      {!isRecipient && <GiftHandoff gift={gift} onUpdated={setGift} />}
      {isRecipient && gift.giftStatus === "DONOR_CLAIMED_PAID" && (
        <RecipientConfirmation gift={gift} onUpdated={setGift} />
      )}

      <SupportPanel gift={gift} />

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/" className="kindly-btn-secondary">
          Discover wishes
        </Link>
        <Link href="/me" className="kindly-btn-quiet">
          My space
        </Link>
      </div>
    </div>
  );
}
