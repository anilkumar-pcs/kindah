"use client";

import { QRCodeSVG } from "qrcode.react";
import { useRef, useState } from "react";

import { ApiError } from "@/lib/api/client";
import {
  newIdempotencyKey,
  reportDonorOutcome,
  type DonorOutcome,
  type Gift,
} from "@/lib/api/gifts";

type GiftHandoffProps = {
  gift: Gift;
  onUpdated: (gift: Gift) => void;
};

const OUTCOME_BUTTONS: Array<{
  outcome: DonorOutcome;
  label: string;
  description: string;
  className: string;
}> = [
  {
    outcome: "PAID",
    label: "Donor says paid",
    description: "Your UPI app showed a successful payment.",
    className: "bg-kindly-accent text-white hover:bg-orange-800",
  },
  {
    outcome: "STILL_PROCESSING",
    label: "Payment still processing",
    description: "Your UPI app has not shown a final result yet.",
    className: "border border-kindly-border bg-white hover:bg-kindly-accent-soft",
  },
  {
    outcome: "FAILED",
    label: "Payment failed / not paid",
    description: "The payment failed, was cancelled, or you did not pay.",
    className: "border border-kindly-border bg-white hover:bg-kindly-accent-soft",
  },
];

function formatDeadline(value: string | null): string | null {
  if (!value) {
    return null;
  }
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function GiftHandoff({ gift, onUpdated }: GiftHandoffProps) {
  const [utr, setUtr] = useState("");
  const [busy, setBusy] = useState<DonorOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const attemptRef = useRef<{ outcome: DonorOutcome; key: string } | null>(null);

  const canReport = gift.giftStatus === "HANDOFF_ISSUED" || gift.giftStatus === "DONOR_PENDING";
  const deadline = formatDeadline(gift.reservationExpiresAt);

  async function handleOutcome(outcome: DonorOutcome) {
    setBusy(outcome);
    setError(null);
    if (!attemptRef.current || attemptRef.current.outcome !== outcome) {
      attemptRef.current = { outcome, key: newIdempotencyKey() };
    }
    const key = attemptRef.current.key;
    try {
      const updated = await reportDonorOutcome(
        gift.giftId,
        outcome,
        key,
        outcome === "PAID" && utr.trim() ? utr.trim() : undefined,
      );
      attemptRef.current = null;
      onUpdated(updated);
    } catch (outcomeError) {
      setError(
        outcomeError instanceof ApiError
          ? outcomeError.message
          : "Could not record the payment result. Try again.",
      );
    } finally {
      setBusy(null);
    }
  }

  if (!canReport) {
    return null;
  }

  return (
    <section
      aria-labelledby="handoff-heading"
      className="rounded-2xl border border-kindly-border bg-white p-5"
    >
      <h2 id="handoff-heading" className="text-lg font-semibold">
        Pay ₹{gift.amountInr} directly over UPI
      </h2>
      <p className="mt-2 text-sm leading-6 text-kindly-muted">
        Open your UPI app to pay {gift.recipientDisplayName ?? "the recipient"}. Kindly does not
        hold your money and cannot reverse a payment. Your UPI app may show the recipient&apos;s
        bank-registered name.
      </p>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
        {gift.qrPayload && (
          <div
            aria-label="UPI payment QR code"
            className="w-fit rounded-2xl border border-kindly-border bg-white p-3"
          >
            <QRCodeSVG value={gift.qrPayload} size={168} level="M" />
          </div>
        )}
        <div className="space-y-3 text-sm">
          {gift.upiIntentUri && (
            <a
              href={gift.upiIntentUri}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-kindly-accent px-5 py-3 font-semibold text-white hover:bg-orange-800"
            >
              Open UPI app
            </a>
          )}
          <p className="text-kindly-muted">
            Reference <span className="font-mono font-semibold">{gift.paymentRefCode}</span>
          </p>
          {deadline && (
            <p className="text-kindly-muted">
              This handoff is reserved until {deadline}. Tell us the result before then.
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-xl bg-kindly-accent-soft p-4">
        <h3 className="font-semibold">Back from your UPI app?</h3>
        <p className="mt-1 text-sm text-kindly-muted">
          These are your attestations, not bank verification. The recipient must confirm receipt
          before the gift is complete.
        </p>
        <div className="mt-4">
          <label htmlFor="utr-reference" className="block text-sm font-medium">
            UTR or reference (optional)
          </label>
          <input
            id="utr-reference"
            name="utrReference"
            type="text"
            maxLength={64}
            value={utr}
            onChange={(event) => setUtr(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="mt-1 min-h-11 w-full rounded-xl border border-kindly-border bg-white px-3 py-2 text-sm"
            placeholder="Only if your UPI app showed one"
          />
        </div>
        <div className="mt-3 grid gap-2">
          {OUTCOME_BUTTONS.map((item) => (
            <button
              key={item.outcome}
              type="button"
              disabled={busy !== null}
              onClick={() => handleOutcome(item.outcome)}
              className={`min-h-11 rounded-xl px-4 py-3 text-left text-sm font-semibold disabled:opacity-60 ${item.className}`}
            >
              <span className="block">{busy === item.outcome ? "Recording…" : item.label}</span>
              <span className="mt-1 block text-xs font-normal opacity-80">{item.description}</span>
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
