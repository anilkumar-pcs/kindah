"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { GiftHandoff } from "@/components/gifts/gift-handoff";
import { Icon } from "@/components/ui/icon";
import { ApiError } from "@/lib/api/client";
import { getPublicWish, type PublicWish } from "@/lib/api/discovery";
import { createGift, newIdempotencyKey, type Gift, type GiftCreateInput } from "@/lib/api/gifts";
import { giftStatusLabel, giftStatusTone } from "@/lib/gifts/labels";
import { restoreSession } from "@/lib/auth/session";

type PageState = "loading" | "guest" | "ready" | "error";
type Step = "amount" | "review" | "handoff";

const QUICK_AMOUNTS = [10, 25, 50, 100];

function GiftSteps({ current }: { current: Step }) {
  const order: Step[] = ["amount", "review", "handoff"];
  const labels = { amount: "Amount", review: "Review", handoff: "UPI" } as const;
  const currentIndex = order.indexOf(current);

  return (
    <div className="flex items-center gap-2">
      {order.map((item, index) => {
        const active = index <= currentIndex;
        return (
          <div key={item} className="flex flex-1 items-center gap-2">
            <span
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-extrabold ${
                active
                  ? "bg-kindly-accent text-white"
                  : "border border-kindly-border bg-kindly-card text-kindly-muted"
              }`}
            >
              <span className="grid h-4 w-4 place-items-center rounded-full border border-current text-[9px]">
                {index + 1}
              </span>
              {labels[item]}
            </span>
            {index < order.length - 1 && (
              <span
                className={`h-px flex-1 ${
                  index < currentIndex ? "bg-kindly-accent" : "bg-kindly-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

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

    restoreSession()
      .then(async (session) => {
        if (cancelled) {
          return;
        }
        if (!session) {
          setPageState("guest");
          return;
        }
        const loadedWish = await getPublicWish(wishId);
        if (cancelled) {
          return;
        }
        if (loadedWish.isOwnWish) {
          setError("This is your own wish. You can manage it from My Space.");
          setPageState("error");
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
      <section aria-busy="true" aria-live="polite" className="mx-auto max-w-2xl">
        <div className="kindly-card p-6">
          <div className="h-3 w-20 animate-pulse rounded-full bg-kindly-accent-soft" />
          <div className="mt-5 h-10 w-2/3 animate-pulse rounded-2xl bg-kindly-accent-soft/70" />
          <p className="mt-5 text-sm text-kindly-muted">Preparing your gift…</p>
        </div>
      </section>
    );
  }

  if (pageState === "guest") {
    return (
      <section className="kindly-card mx-auto max-w-xl p-7 sm:p-9">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-kindly-accent-soft text-kindly-accent">
          <Icon name="gift" className="h-6 w-6" />
        </span>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-[-0.055em]">
          Sign in to send a gift
        </h1>
        <p className="mt-3 text-sm leading-6 text-kindly-muted">
          You can browse anonymously. Signing in is required before reserving a wish and opening a
          UPI handoff.
        </p>
        <Link
          href={`/sign-in?next=${encodeURIComponent(`/gifts/new/${wishId}`)}`}
          className="kindly-btn-primary mt-6"
        >
          Sign in to continue <Icon name="arrow-right" className="h-4 w-4" />
        </Link>
      </section>
    );
  }

  if (pageState === "error" || !wish) {
    return (
      <section className="kindly-card mx-auto max-w-xl p-7 sm:p-9">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-kindly-blush text-kindly-coral">
          <Icon name="gift" className="h-6 w-6" />
        </span>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-[-0.055em]">
          Could not start this gift
        </h1>
        <p role="alert" className="kindly-status-error mt-3">
          {error ?? "This wish is unavailable."}
        </p>
        <Link href="/" className="kindly-btn-primary mt-6">
          Back to discovery
        </Link>
      </section>
    );
  }

  const status = gift ? giftStatusLabel(gift.giftStatus) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href={`/wishes/${wish.id}`} className="kindly-btn-quiet !min-h-9 !px-2">
          <span aria-hidden="true">←</span> Back to the wish
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="kindly-eyebrow">A little gift</p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">
              For {wish.displayName}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-kindly-muted">{wish.message}</p>
          </div>
          <span className="kindly-chip">
            <Icon name="shield" className="h-3 w-3" /> Direct UPI
          </span>
        </div>
      </div>

      <GiftSteps current={step} />

      {error && (
        <p role="alert" className="kindly-status-error">
          {error}
        </p>
      )}

      {step === "amount" && (
        <form noValidate onSubmit={handleReview} className="kindly-card p-5 sm:p-7">
          <h2 className="font-display text-2xl font-semibold tracking-[-0.045em]">
            Choose an amount
          </h2>
          <p className="mt-1 text-sm leading-6 text-kindly-muted">
            Whole rupees only, from ₹10 to ₹100. You pay directly over UPI.
          </p>
          <div className="mt-5 grid grid-cols-4 gap-2">
            {QUICK_AMOUNTS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={amount === String(value)}
                onClick={() => {
                  setAmount(String(value));
                  createKeyRef.current = null;
                }}
                className={`min-h-12 rounded-2xl border px-2 py-2 font-display text-lg font-bold ${
                  amount === String(value)
                    ? "border-kindly-accent bg-kindly-accent text-white"
                    : "border-kindly-border bg-kindly-card text-kindly-ink hover:bg-kindly-accent-soft"
                }`}
              >
                ₹{value}
              </button>
            ))}
          </div>
          <div className="mt-5">
            <label htmlFor="gift-amount" className="kindly-label">
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
              className="kindly-input mt-1"
              placeholder="10–100"
            />
          </div>
          <div className="mt-4">
            <label htmlFor="cheer-note" className="kindly-label">
              Cheer note <span className="font-medium text-kindly-muted">(optional)</span>
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
              className="kindly-input mt-1"
              placeholder="A short, kind note"
              aria-describedby="cheer-note-help"
            />
            <p id="cheer-note-help" className="kindly-help">
              {cheer.length}/80 characters. No phone numbers, UPI IDs, links or HTML.
            </p>
          </div>
          <button type="submit" className="kindly-btn-primary mt-5 w-full">
            Review gift <Icon name="arrow-right" className="h-4 w-4" />
          </button>
        </form>
      )}

      {step === "review" && (
        <section aria-labelledby="review-heading" className="kindly-card p-5 sm:p-7">
          <h2
            id="review-heading"
            className="font-display text-2xl font-semibold tracking-[-0.045em]"
          >
            Review your gift
          </h2>
          <dl className="mt-5 divide-y divide-kindly-border/70 text-sm">
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-kindly-muted">Recipient</dt>
              <dd className="font-bold">{wish.displayName}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-kindly-muted">Amount</dt>
              <dd className="font-display text-2xl font-bold tracking-[-0.04em]">₹{amount}</dd>
            </div>
            {cheer.trim() && (
              <div className="flex items-start justify-between gap-4 py-3">
                <dt className="text-kindly-muted">Cheer note</dt>
                <dd className="text-right">{cheer.trim()}</dd>
              </div>
            )}
          </dl>
          <div className="kindly-card-soft mt-4 p-4 text-sm leading-6">
            <p className="font-bold">Before you continue</p>
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
              className="kindly-btn-primary flex-1"
            >
              {busy ? "Creating handoff…" : "Create UPI handoff"}
              <Icon name="arrow-right" className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setError(null);
                setStep("amount");
              }}
              className="kindly-btn-secondary"
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
            className={`rounded-2xl p-5 ring-1 ${giftStatusTone(gift.giftStatus)}`}
          >
            <p className="text-[10px] font-extrabold tracking-[0.14em] uppercase">Gift status</p>
            <p className="mt-1 font-display text-xl font-semibold tracking-[-0.04em]">{status}</p>
            {gift.giftStatus === "DONOR_CLAIMED_PAID" && (
              <p className="mt-1 text-sm leading-6">
                You have told us the payment was made. The recipient now has 24 hours to confirm
                receipt.
              </p>
            )}
          </div>
          <GiftHandoff gift={gift} onUpdated={setGift} />
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href={`/gifts/${gift.giftId}`} className="kindly-btn-secondary">
              View gift details
            </Link>
            <Link href="/me" className="kindly-btn-quiet">
              My space
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
