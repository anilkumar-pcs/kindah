"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { ApiError } from "@/lib/api/client";
import { listMyGifts, type Gift } from "@/lib/api/gifts";
import { getPaymentMethod, savePaymentMethod, type PaymentMethod } from "@/lib/api/payment-methods";
import { createWish, listMyWishes, withdrawWish, type Wish, type WishMood } from "@/lib/api/wishes";
import { listBlocks, unblockUser, type BlockedUser } from "@/lib/api/safety";
import { giftStatusLabel } from "@/lib/gifts/labels";
import { restoreSession, type UserProfile } from "@/lib/auth/session";

const MOODS: Array<{ value: WishMood; label: string }> = [
  { value: "CHAI_SNACK", label: "Chai & snack" },
  { value: "JUST_BECAUSE", label: "Just because" },
  { value: "LONG_DAY", label: "Long day" },
  { value: "TINY_TREAT", label: "Tiny treat" },
];

type PageState = "loading" | "guest" | "ready" | "error";

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return "Something went wrong. Try again.";
}

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function moodLabel(mood: WishMood): string {
  return MOODS.find((item) => item.value === mood)?.label ?? mood;
}

export function MySpace() {
  const [state, setState] = useState<PageState>("loading");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [blocks, setBlocks] = useState<BlockedUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reauthRequired, setReauthRequired] = useState(false);
  const [busy, setBusy] = useState(false);

  const [editingVpa, setEditingVpa] = useState(false);
  const [vpa, setVpa] = useState("");
  const [privacyAck, setPrivacyAck] = useState(false);

  const [message, setMessage] = useState("");
  const [mood, setMood] = useState<WishMood>("JUST_BECAUSE");
  const [amount, setAmount] = useState("");
  const [city, setCity] = useState("");

  const activeWish = useMemo(
    () => wishes.find((wish) => wish.status === "OPEN" || wish.status === "LOCKED") ?? null,
    [wishes],
  );

  const cooldownUntil = useMemo(() => {
    const values = wishes
      .map((wish) => wish.cooldownUntil)
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).getTime())
      .filter((value) => !Number.isNaN(value));
    return values.length ? new Date(Math.max(...values)) : null;
  }, [wishes]);

  useEffect(() => {
    let cancelled = false;

    restoreSession().then(async (restored) => {
      if (cancelled) {
        return;
      }
      if (!restored) {
        setState("guest");
        return;
      }
      setUser(restored);
      try {
        const [method, history, giftHistory, blockedUsers] = await Promise.all([
          getPaymentMethod(),
          listMyWishes(),
          listMyGifts(),
          listBlocks(),
        ]);
        if (cancelled) {
          return;
        }
        setPaymentMethod(method);
        setWishes(history);
        setGifts(giftHistory);
        setBlocks(blockedUsers);
        setEditingVpa(method === null);
        setState("ready");
      } catch (loadError) {
        if (!cancelled) {
          setError(errorMessage(loadError));
          setState("error");
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSaveVpa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setReauthRequired(false);
    if (!privacyAck) {
      setError("Acknowledge the UPI name disclosure before saving.");
      return;
    }
    setBusy(true);
    try {
      const saved = await savePaymentMethod(vpa, true);
      setPaymentMethod(saved);
      setEditingVpa(false);
      setVpa("");
      setPrivacyAck(false);
    } catch (saveError) {
      if (saveError instanceof ApiError && saveError.code === "REAUTHENTICATION_REQUIRED") {
        setReauthRequired(true);
      }
      setError(errorMessage(saveError));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateWish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const trimmed = message.trim();
    if (trimmed.length < 10 || trimmed.length > 120) {
      setError("Wish message must be between 10 and 120 characters.");
      return;
    }

    let suggestedAmount: number | undefined;
    if (amount.trim() !== "") {
      if (!/^\d+$/.test(amount.trim())) {
        setError("Suggested amount must be a whole number of rupees.");
        return;
      }
      const parsed = Number(amount);
      if (parsed < 10 || parsed > 100) {
        setError("Suggested amount must be between ₹10 and ₹100.");
        return;
      }
      suggestedAmount = parsed;
    }

    setBusy(true);
    try {
      const created = await createWish({
        message: trimmed,
        mood,
        ...(suggestedAmount !== undefined ? { suggestedAmountInr: suggestedAmount } : {}),
        ...(city.trim() ? { city: city.trim() } : {}),
      });
      setWishes((current) => [created, ...current]);
      setMessage("");
      setAmount("");
      setCity("");
    } catch (createError) {
      setError(errorMessage(createError));
    } finally {
      setBusy(false);
    }
  }

  async function handleUnblock(userId: string) {
    setBusy(true);
    setError(null);
    try {
      await unblockUser(userId);
      setBlocks((current) => current.filter((block) => block.blockedUserId !== userId));
    } catch (unblockError) {
      setError(errorMessage(unblockError));
    } finally {
      setBusy(false);
    }
  }

  async function handleWithdraw(wishId: string) {
    setBusy(true);
    setError(null);
    try {
      const updated = await withdrawWish(wishId);
      setWishes((current) => current.map((wish) => (wish.id === wishId ? updated : wish)));
    } catch (withdrawError) {
      setError(errorMessage(withdrawError));
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") {
    return (
      <section
        aria-busy="true"
        aria-live="polite"
        className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-kindly-border"
      >
        <p className="text-sm text-kindly-muted">Loading your space…</p>
      </section>
    );
  }

  if (state === "guest") {
    return (
      <section className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-kindly-border sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">My Kindness</h1>
        <p className="mt-3 text-sm leading-6 text-kindly-muted">
          Sign in to save a UPI ID, publish one wish and see your history.
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

  if (state === "error" || !user) {
    return (
      <section className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-kindly-border sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">My Kindness</h1>
        <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error ?? "Could not load your space."}
        </p>
        <Link
          href="/sign-in"
          className="mt-6 inline-block text-sm font-semibold text-kindly-accent"
        >
          Sign in again
        </Link>
      </section>
    );
  }

  const canPublish = Boolean(paymentMethod) && !activeWish && !cooldownUntil;
  const charCount = message.length;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <p className="text-sm font-semibold tracking-wide text-kindly-accent uppercase">
          My Kindness
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {user.displayName ?? "Your space"}
        </h1>
        <p className="mt-2 text-sm text-kindly-muted">
          Your UPI ID is private. Donors only see your pseudonym and wish.
        </p>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          <Link href="/appeals" className="font-semibold text-kindly-accent underline">
            Moderation appeals
          </Link>
          <Link href="/account-deletion" className="font-semibold text-kindly-accent underline">
            Account deletion
          </Link>
        </div>
      </header>

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          <p>{error}</p>
          {reauthRequired && (
            <Link href="/reauth" className="mt-2 inline-block font-semibold underline">
              Sign in again to change your UPI ID
            </Link>
          )}
        </div>
      )}

      <section
        aria-labelledby="payment-method-heading"
        className="rounded-2xl border border-kindly-border bg-white p-5"
      >
        <h2 id="payment-method-heading" className="text-lg font-semibold">
          Receiving UPI ID
        </h2>

        {paymentMethod && !editingVpa ? (
          <div className="mt-3 space-y-2 text-sm">
            <p className="text-base font-semibold">{paymentMethod.maskedVpa}</p>
            <p className="text-kindly-muted">
              Version {paymentMethod.version} · Format checked only (ownership is not verified).
            </p>
            <p className="text-xs text-kindly-muted">
              Last updated {formatDate(paymentMethod.updatedAt)}
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingVpa(true);
                setVpa("");
                setPrivacyAck(false);
                setError(null);
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-kindly-border px-4 py-2 text-sm font-semibold hover:bg-kindly-accent-soft"
            >
              Change UPI ID
            </button>
          </div>
        ) : (
          <form className="mt-4 space-y-4" onSubmit={handleSaveVpa}>
            <div>
              <label htmlFor="vpa" className="block text-sm font-medium">
                UPI ID
              </label>
              <input
                id="vpa"
                name="vpa"
                type="text"
                autoComplete="off"
                spellCheck={false}
                required
                value={vpa}
                onChange={(event) => setVpa(event.target.value)}
                placeholder="name@provider"
                className="mt-1 min-h-11 w-full rounded-xl border border-kindly-border px-3 py-2 text-sm"
                aria-describedby="vpa-help"
              />
              <p id="vpa-help" className="mt-1 text-xs text-kindly-muted">
                We check the format only. We cannot verify ownership or that the UPI ID can receive
                money.
              </p>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5"
                checked={privacyAck}
                onChange={(event) => setPrivacyAck(event.target.checked)}
              />
              <span>I understand my UPI app may show my bank-registered name to the donor.</span>
            </label>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-kindly-accent px-5 py-3 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save UPI ID"}
            </button>
          </form>
        )}
      </section>

      {activeWish && (
        <section
          aria-labelledby="active-wish-heading"
          className="rounded-2xl border border-kindly-border bg-white p-5"
        >
          <h2 id="active-wish-heading" className="text-lg font-semibold">
            Your active wish
          </h2>
          <div className="mt-3 space-y-2 text-sm">
            <p className="text-base">{activeWish.message}</p>
            <p className="text-kindly-muted">
              {moodLabel(activeWish.mood)}
              {activeWish.suggestedAmountInr
                ? ` · suggested ₹${activeWish.suggestedAmountInr}`
                : " · donor chooses amount"}
              {activeWish.city ? ` · ${activeWish.city}` : ""}
            </p>
            <p className="text-kindly-muted">Expires {formatDate(activeWish.expiresAt)}</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => handleWithdraw(activeWish.id)}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-kindly-border px-4 py-2 text-sm font-semibold hover:bg-kindly-accent-soft disabled:opacity-60"
            >
              {busy ? "Withdrawing…" : "Withdraw wish"}
            </button>
          </div>
        </section>
      )}

      {!activeWish && cooldownUntil && (
        <section className="rounded-2xl border border-kindly-border bg-kindly-accent-soft p-5 text-sm">
          <h2 className="text-lg font-semibold">Cooldown</h2>
          <p className="mt-2 text-kindly-muted">
            You can publish another wish after {formatDate(cooldownUntil.toISOString())}.
          </p>
        </section>
      )}

      <section
        aria-labelledby="create-wish-heading"
        className="rounded-2xl border border-kindly-border bg-white p-5"
      >
        <h2 id="create-wish-heading" className="text-lg font-semibold">
          Create a wish
        </h2>

        {!paymentMethod && (
          <p className="mt-2 text-sm text-kindly-muted">
            Add your UPI ID above before publishing a wish.
          </p>
        )}

        {paymentMethod && !canPublish && (
          <p className="mt-2 text-sm text-kindly-muted">
            You can publish again after your active wish or cooldown ends.
          </p>
        )}

        {canPublish && (
          <form className="mt-4 space-y-4" onSubmit={handleCreateWish}>
            <div>
              <label htmlFor="wish-message" className="block text-sm font-medium">
                Wish message
              </label>
              <textarea
                id="wish-message"
                name="message"
                required
                minLength={10}
                maxLength={120}
                rows={3}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="mt-1 w-full rounded-xl border border-kindly-border px-3 py-2 text-sm"
                aria-describedby="wish-message-help"
              />
              <p id="wish-message-help" className="mt-1 text-xs text-kindly-muted">
                {charCount}/120 characters. No links, phone numbers, UPI IDs or HTML.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="wish-mood" className="block text-sm font-medium">
                  Mood
                </label>
                <select
                  id="wish-mood"
                  value={mood}
                  onChange={(event) => setMood(event.target.value as WishMood)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-kindly-border bg-white px-3 py-2 text-sm"
                >
                  {MOODS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="wish-amount" className="block text-sm font-medium">
                  Suggested amount (optional)
                </label>
                <input
                  id="wish-amount"
                  name="amount"
                  type="number"
                  min={10}
                  max={100}
                  step={1}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-kindly-border px-3 py-2 text-sm"
                  placeholder="₹10–₹100"
                />
              </div>
            </div>

            <div>
              <label htmlFor="wish-city" className="block text-sm font-medium">
                City (optional)
              </label>
              <input
                id="wish-city"
                name="city"
                type="text"
                maxLength={60}
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-kindly-border px-3 py-2 text-sm"
              />
            </div>

            <div className="rounded-xl bg-kindly-accent-soft p-4 text-sm">
              <p className="text-xs font-semibold tracking-wide text-kindly-accent uppercase">
                Preview
              </p>
              <p className="mt-2">{message || "Your wish message will appear here."}</p>
              <p className="mt-1 text-kindly-muted">
                {moodLabel(mood)}
                {amount ? ` · suggested ₹${amount}` : " · donor chooses amount"}
                {city ? ` · ${city}` : ""}
              </p>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-kindly-accent px-5 py-3 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
            >
              {busy ? "Publishing…" : "Publish wish"}
            </button>
          </form>
        )}
      </section>

      <section aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-lg font-semibold">
          Wish history
        </h2>
        {wishes.length === 0 ? (
          <p className="mt-2 text-sm text-kindly-muted">No wishes yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {wishes.map((wish) => (
              <li
                key={wish.id}
                className="rounded-2xl border border-kindly-border bg-white p-4 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{wish.status}</span>
                  <span className="text-xs text-kindly-muted">{formatDate(wish.createdAt)}</span>
                </div>
                <p className="mt-2">{wish.message}</p>
                <p className="mt-1 text-kindly-muted">
                  {moodLabel(wish.mood)}
                  {wish.suggestedAmountInr
                    ? ` · suggested ₹${wish.suggestedAmountInr}`
                    : " · donor chooses amount"}
                  {wish.closedReason ? ` · ${wish.closedReason.toLowerCase()}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="gift-history-heading">
        <h2 id="gift-history-heading" className="text-lg font-semibold">
          Gift history
        </h2>
        {gifts.length === 0 ? (
          <p className="mt-2 text-sm text-kindly-muted">No gifts yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {gifts.map((gift) => (
              <li key={gift.giftId}>
                <Link
                  href={`/gifts/${gift.giftId}`}
                  className="block rounded-2xl border border-kindly-border bg-white p-4 text-sm hover:border-kindly-accent"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">₹{gift.amountInr}</span>
                    <span className="text-xs font-semibold text-kindly-accent">
                      {giftStatusLabel(gift.giftStatus)}
                    </span>
                  </div>
                  <p className="mt-2 text-kindly-muted">
                    {gift.viewerRole === "DONOR"
                      ? `You sent this to ${gift.recipientDisplayName ?? "a recipient"}.`
                      : "A kind donor sent this to you."}
                  </p>
                  <p className="mt-1 text-xs text-kindly-muted">
                    {formatDate(gift.createdAt)} · reference {gift.paymentRefCode}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {blocks.length > 0 && (
        <section aria-labelledby="blocked-accounts-heading">
          <h2 id="blocked-accounts-heading" className="text-lg font-semibold">
            Blocked accounts
          </h2>
          <p className="mt-1 text-sm text-kindly-muted">
            You and these accounts cannot discover or interact with each other.
          </p>
          <ul className="mt-3 space-y-2">
            {blocks.map((block) => {
              const name = block.displayName ?? "Kindly user";
              return (
                <li
                  key={block.blockedUserId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-kindly-border bg-white p-4 text-sm"
                >
                  <span className="font-semibold">{name}</span>
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={`Unblock ${name}`}
                    onClick={() => handleUnblock(block.blockedUserId)}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-kindly-border px-4 py-2 text-sm font-semibold hover:bg-kindly-accent-soft disabled:opacity-60"
                  >
                    Unblock
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
