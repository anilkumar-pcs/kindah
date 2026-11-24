"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { GiftHandoff } from "@/components/gifts/gift-handoff";
import { ApiError } from "@/lib/api/client";
import { getPublicWish, type PublicWish } from "@/lib/api/discovery";
import { createGift, newIdempotencyKey, type Gift, type GiftCreateInput } from "@/lib/api/gifts";
import { giftStatusLabel, giftStatusTone } from "@/lib/gifts/labels";
import { restoreSession } from "@/lib/auth/session";

type PageState = "loading" | "guest" | "ready" | "error";
type Step = "amount" | "review" | "handoff";

const QUICK_AMOUNTS = [10, 25, 50, 100];

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return "Something went wrong. Try again.";
}

export function GiftFlow({ wishId }: { wishId: string }) {
  const [pageState, setPageState] = useState<PageState>("loading");
  const [wish, setWish] = useState<PublicWish | null>(null);
  const [gift, setGift] = useState<Gift | null>(null);
  const [step, setStep] = useState<Step>("amount");
  const [amount, setAmount] = useState("");
  const [cheer, setCheer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([restoreSession(), getPublicWish(wishId)])
      .then(([session, loadedWish]) => {
        if (cancelled) {
          return;
        }
        if (!session) {
          setPageState("guest");
          return;
        }
        setWish(loadedWish);
        if (loadedWish.suggestedAmountInr) {
          setAmount(String(loadedWish.suggestedAmountInr));
        }
        setPageState("ready");
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(errorMessage(loadError));
          setPageState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [wishId]);

  function parseAmount(): number | null {
    const trimmed = amount.trim();
    if (!/^\d+$/.test(trimmed)) {
      setError("Enter a whole number of rupees between ₹10 and ₹100.");
      return null;
    }
    const parsed = Number(trimmed);
    if (parsed < 10 || parsed > 100) {
      setError("Gifts must be between ₹10 and ₹100.");
      return null;
    }
    return parsed;
  }

  function handleReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (parseAmount() === null) {
      return;
    }
    if (cheer.trim().length > 80) {
      setError("Cheer note must be 80 characters or fewer.");
      return;
    }
    createKeyRef.current = null;
    setStep("review");
  }

  async function handleCreate() {
    const parsed = parseAmount();
    if (parsed === null || !wish) {
      return;
    }
    setBusy(true);
    setError(null);
    if (!createKeyRef.current) {
      createKeyRef.current = newIdempotencyKey();
    }
    const input: GiftCreateInput = {
      wishId: wish.id,
      amountInr: parsed,
      ...(cheer.trim() ? { cheerNote: cheer.trim() } : {}),
    };
    try {
      const created = await createGift(input, createKeyRef.current);
      createKeyRef.current = null;
      setGift(created);
      setStep("handoff");
    } catch (createError) {
      if (createError instanceof ApiError && createError.status === 401) {
        setPageState("guest");
      } else {
        setError(errorMessage(createError));
      }
    } finally {
      setBusy(false);
    }
  }

  if (pageState === "loading") {
    return (
      <section
        aria-busy="true"
        aria-live="polite"
        className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-kindly-border"
      >
        <p className="text-sm text-kindly-muted">Preparing your gift…</p>
      </section>
    );
  }

  if (pageState === "guest") {
    return (
      <section className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-kindly-border sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to send a gift</h1>
        <p className="mt-3 text-sm leading-6 text-kindly-muted">
          You can browse anonymously. Signing in is required before reserving a wish and opening a
          UPI handoff.
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

  if (pageState === "error" || !wish) {
    return (
      <section className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-kindly-border sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Could not start this gift</h1>
        <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error ?? "This wish is unavailable."}
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

  const status = gift ? giftStatusLabel(gift.giftStatus) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="text-sm font-semibold tracking-wide text-kindly-accent uppercase">Gift</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">For {wish.displayName}</h1>
        <p className="mt-2 text-sm leading-6 text-kindly-muted">{wish.message}</p>
      </header>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {step === "amount" && (
        <form
          noValidate
          onSubmit={handleReview}
          className="rounded-2xl border border-kindly-border bg-white p-5"
        >
          <h2 className="text-lg font-semibold">Choose an amount</h2>
          <p className="mt-1 text-sm text-kindly-muted">
            Whole rupees only, from ₹10 to ₹100. You pay directly over UPI.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {QUICK_AMOUNTS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={amount === String(value)}
                onClick={() => {
                  setAmount(String(value));
                  createKeyRef.current = null;
                }}
                className={`min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold ${
                  amount === String(value)
                    ? "border-kindly-accent bg-kindly-accent text-white"
                    : "border-kindly-border bg-white hover:bg-kindly-accent-soft"
                }`}
              >
                ₹{value}
              </button>
            ))}
          </div>
          <div className="mt-4">
            <label htmlFor="gift-amount" className="block text-sm font-medium">
              Amount in rupees
            </label>
            <input
              id="gift-amount"
              name="amountInr"
              type="number"
              inputMode="numeric"
              min={10}
              max={100}
              step={1}
              required
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                createKeyRef.current = null;
              }}
              className="mt-1 min-h-11 w-full rounded-xl border border-kindly-border px-3 py-2 text-sm"
              placeholder="10–100"
            />
          </div>
          <div className="mt-4">
            <label htmlFor="cheer-note" className="block text-sm font-medium">
              Cheer note (optional)
            </label>
            <input
              id="cheer-note"
              name="cheerNote"
              type="text"
              maxLength={80}
              value={cheer}
              onChange={(event) => {
                setCheer(event.target.value);
                createKeyRef.current = null;
              }}
              className="mt-1 min-h-11 w-full rounded-xl border border-kindly-border px-3 py-2 text-sm"
              placeholder="A short, kind note"
              aria-describedby="cheer-note-help"
            />
            <p id="cheer-note-help" className="mt-1 text-xs text-kindly-muted">
              {cheer.length}/80 characters. No phone numbers, UPI IDs, links or HTML.
            </p>
          </div>
          <button
            type="submit"
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-kindly-accent px-5 py-3 text-sm font-semibold text-white hover:bg-orange-800"
          >
            Review gift
          </button>
        </form>
      )}

      {step === "review" && (
        <section
          aria-labelledby="review-heading"
          className="rounded-2xl border border-kindly-border bg-white p-5"
        >
          <h2 id="review-heading" className="text-lg font-semibold">
            Review your gift
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-kindly-muted">Recipient</dt>
              <dd className="font-semibold">{wish.displayName}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-kindly-muted">Amount</dt>
              <dd className="text-xl font-semibold">₹{amount}</dd>
            </div>
            {cheer.trim() && (
              <div className="flex items-start justify-between gap-4">
                <dt className="text-kindly-muted">Cheer note</dt>
                <dd className="text-right">{cheer.trim()}</dd>
              </div>
            )}
          </dl>
          <div className="mt-4 rounded-xl bg-kindly-accent-soft p-4 text-sm leading-6">
            <p className="font-semibold">Before you continue</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-kindly-muted">
              <li>The next step opens your UPI app with the recipient&apos;s payment details.</li>
              <li>Kindly does not hold, escrow or verify the money.</li>
              <li>You must tell us the result after returning from your UPI app.</li>
              <li>The recipient must confirm receipt before the gift is complete.</li>
            </ul>
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={busy}
              onClick={handleCreate}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-kindly-accent px-5 py-3 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
            >
              {busy ? "Creating handoff…" : "Create UPI handoff"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setError(null);
                setStep("amount");
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-kindly-border px-5 py-3 text-sm font-semibold hover:bg-kindly-accent-soft disabled:opacity-60"
            >
              Change amount
            </button>
          </div>
        </section>
      )}

      {step === "handoff" && gift && (
        <>
          <div
            aria-live="polite"
            className={`rounded-2xl p-4 ring-1 ${giftStatusTone(gift.giftStatus)}`}
          >
            <p className="text-xs font-semibold tracking-wide uppercase">Gift status</p>
            <p className="mt-1 text-lg font-semibold">{status}</p>
            {gift.giftStatus === "DONOR_CLAIMED_PAID" && (
              <p className="mt-1 text-sm">
                You have told us the payment was made. The recipient now has 24 hours to confirm
                receipt.
              </p>
            )}
          </div>
          <GiftHandoff gift={gift} onUpdated={setGift} />
          <div className="flex flex-wrap gap-3 text-sm">
            <Link
              href={`/gifts/${gift.giftId}`}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-kindly-border bg-white px-5 py-3 font-semibold hover:bg-kindly-accent-soft"
            >
              View gift details
            </Link>
            <Link
              href="/me"
              className="inline-flex min-h-11 items-center justify-center rounded-xl px-2 py-3 font-semibold text-kindly-accent underline"
            >
              My space
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
