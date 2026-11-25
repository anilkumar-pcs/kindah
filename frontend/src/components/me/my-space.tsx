"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import { ApiError } from "@/lib/api/client";
import { listMyGifts, type Gift } from "@/lib/api/gifts";
import { getKarmaSummary, type KarmaSummary } from "@/lib/api/karma";
import { getPaymentMethod, savePaymentMethod, type PaymentMethod } from "@/lib/api/payment-methods";
import { createWish, listMyWishes, withdrawWish, type Wish, type WishMood } from "@/lib/api/wishes";
import { listBlocks, unblockUser, type BlockedUser } from "@/lib/api/safety";
import { giftStatusLabel } from "@/lib/gifts/labels";
import { restoreSession, type UserProfile } from "@/lib/auth/session";

const KARMA_EVENT_LABELS: Record<string, string> = {
  FIRST_CONFIRMED_GIFT: "First confirmed gift",
  CONFIRMED_GIFT: "Confirmed gift",
  FIRST_TIME_RECIPIENT_BONUS: "First-time recipient bonus",
  RECIPIENT_THANKS: "Recipient thanks",
  PAY_IT_FORWARD: "Pay it forward",
};

const MOODS: Array<{ value: WishMood; label: string }> = [
  { value: "CHAI_SNACK", label: "Chai & snack" },
  { value: "JUST_BECAUSE", label: "Just because" },
  { value: "LONG_DAY", label: "Long day" },
  { value: "TINY_TREAT", label: "Tiny treat" },
];

type PageState = "loading" | "guest" | "ready" | "error";
type SpaceTab = "overview" | "wish" | "gifts" | "account";

const SPACE_TABS: Array<{ value: SpaceTab; label: string; icon: IconName }> = [
  { value: "overview", label: "Overview", icon: "sparkle" },
  { value: "wish", label: "Wish", icon: "sun" },
  { value: "gifts", label: "Gifts", icon: "gift" },
  { value: "account", label: "Account", icon: "shield" },
];

function tabFromHash(hash: string): SpaceTab {
  const value = hash.replace(/^#/, "");
  return SPACE_TABS.some((tab) => tab.value === value) ? (value as SpaceTab) : "overview";
}

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
  const [karma, setKarma] = useState<KarmaSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reauthRequired, setReauthRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<SpaceTab>("overview");

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

  const confirmedGifts = useMemo(
    () => gifts.filter((gift) => gift.giftStatus === "RECIPIENT_CONFIRMED"),
    [gifts],
  );

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
        const [method, history, giftHistory, blockedUsers, karmaSummary] = await Promise.all([
          getPaymentMethod(),
          listMyWishes(),
          listMyGifts(),
          listBlocks(),
          getKarmaSummary(),
        ]);
        if (cancelled) {
          return;
        }
        setPaymentMethod(method);
        setWishes(history);
        setGifts(giftHistory);
        setBlocks(blockedUsers);
        setKarma(karmaSummary);
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

  useEffect(() => {
    const syncTab = () => setTab(tabFromHash(window.location.hash));
    syncTab();
    window.addEventListener("hashchange", syncTab);
    return () => window.removeEventListener("hashchange", syncTab);
  }, []);

  function selectTab(next: SpaceTab) {
    setTab(next);
    if (typeof window !== "undefined") {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#${next}`,
      );
    }
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const currentIndex = SPACE_TABS.findIndex((item) => item.value === tab);
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % SPACE_TABS.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + SPACE_TABS.length) % SPACE_TABS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = SPACE_TABS.length - 1;
    }

    if (nextIndex === null) {
      return;
    }
    event.preventDefault();
    const next = SPACE_TABS[nextIndex].value;
    selectTab(next);
    document.getElementById(`space-tab-${next}`)?.focus();
  }

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
      <section aria-busy="true" aria-live="polite" className="kindly-card mx-auto max-w-3xl p-6">
        <p className="text-sm text-kindly-muted">Loading your space…</p>
      </section>
    );
  }

  if (state === "guest") {
    return (
      <section className="kindly-card mx-auto max-w-xl p-6 sm:p-8">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-kindly-accent-soft text-kindly-accent">
          <Icon name="heart" className="h-6 w-6" />
        </span>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-[-0.055em]">
          My Kindness
        </h1>
        <p className="mt-3 text-sm leading-6 text-kindly-muted">
          Sign in to save a UPI ID, publish one wish and see your history.
        </p>
        <Link href="/sign-in" className="kindly-btn-primary mt-6">
          Sign in
        </Link>
      </section>
    );
  }

  if (state === "error" || !user) {
    return (
      <section className="kindly-card mx-auto max-w-xl p-6 sm:p-8">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-kindly-accent-soft text-kindly-accent">
          <Icon name="heart" className="h-6 w-6" />
        </span>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-[-0.055em]">
          My Kindness
        </h1>
        <p role="alert" className="kindly-status-error mt-4">
          {error ?? "Could not load your space."}
        </p>
        <Link href="/sign-in" className="kindly-btn-quiet mt-4 !px-0">
          Sign in again
        </Link>
      </section>
    );
  }

  const canPublish = Boolean(paymentMethod) && !activeWish && !cooldownUntil;
  const charCount = message.length;
  const badgeCount = karma?.badges.length ?? 0;
  const nextStep = !paymentMethod
    ? {
        title: "Add where kindness can reach you",
        body: "Save a UPI ID so a donor can open a direct payment handoff. It stays private.",
        action: "Add UPI ID",
        tab: "account" as SpaceTab,
      }
    : activeWish
      ? {
          title: "Your wish is out there",
          body: "It is visible to kind strangers. You can withdraw it any time.",
          action: "View your wish",
          tab: "wish" as SpaceTab,
        }
      : cooldownUntil
        ? {
            title: "A little pause",
            body: "One wish at a time keeps things calm. You can publish again after cooldown.",
            action: "See when",
            tab: "wish" as SpaceTab,
          }
        : {
            title: "Share one small wish",
            body: "A chai, a snack, a tiny treat. Keep it simple and let someone be kind.",
            action: "Create a wish",
            tab: "wish" as SpaceTab,
          };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <section className="relative overflow-hidden rounded-[2rem] bg-kindly-accent-soft p-4 sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -right-12 h-48 w-48 rounded-full bg-kindly-marigold/50 blur-2xl"
        />
        <div className="relative flex flex-wrap items-center gap-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-kindly-card font-display text-2xl font-bold text-kindly-coral shadow-[0_3px_0_rgb(23_59_51_/_8%)]">
            {(user.displayName ?? "K").slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="kindly-eyebrow">Your little corner</p>
            <h1 className="mt-0.5 font-display text-3xl font-semibold tracking-[-0.06em] sm:text-4xl">
              {user.displayName ?? "Your space"}
            </h1>
            <p className="mt-1 text-sm leading-5 text-kindly-muted">
              Your UPI ID is private. Donors only see your pseudonym and wish.
            </p>
          </div>
          <span className="kindly-chip">
            <Icon name="heart" className="h-3 w-3" /> Little things add up
          </span>
        </div>
        <div className="relative mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-kindly-card/85 px-3 py-1.5 text-xs font-bold text-kindly-accent">
            <strong className="font-display text-lg">{karma?.balance ?? user.karma}</strong> karma
          </span>
          <span className="rounded-full bg-kindly-card/85 px-3 py-1.5 text-xs font-bold text-kindly-accent">
            <strong className="font-display text-lg">{karma?.streak ?? user.streak}</strong> day
            streak
          </span>
          <span className="rounded-full bg-kindly-card/85 px-3 py-1.5 text-xs font-bold text-kindly-muted">
            {badgeCount} {badgeCount === 1 ? "badge" : "badges"}
          </span>
        </div>
      </section>

      <div
        role="tablist"
        aria-label="My Space sections"
        onKeyDown={handleTabKeyDown}
        className="flex gap-1 overflow-x-auto rounded-2xl border border-kindly-border bg-kindly-card p-1"
      >
        {SPACE_TABS.map((item) => {
          const selected = tab === item.value;
          return (
            <button
              key={item.value}
              id={`space-tab-${item.value}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`space-panel-${item.value}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => selectTab(item.value)}
              className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl px-2.5 text-xs font-extrabold whitespace-nowrap transition ${
                selected
                  ? "bg-kindly-accent text-white shadow-sm"
                  : "text-kindly-muted hover:bg-kindly-accent-soft hover:text-kindly-accent"
              }`}
            >
              <Icon name={item.icon} className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div role="alert" className="kindly-status-error">
          <p>{error}</p>
          {reauthRequired && (
            <Link href="/reauth" className="mt-2 inline-block font-semibold underline">
              Sign in again to change your UPI ID
            </Link>
          )}
        </div>
      )}

      <section
        id="space-panel-overview"
        role="tabpanel"
        aria-labelledby="space-tab-overview"
        hidden={tab !== "overview"}
        className="space-y-4"
      >
        <div className="kindly-card flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <div className="min-w-0 flex-1">
            <p className="kindly-eyebrow">Next little step</p>
            <h2 className="mt-1 font-display text-xl font-semibold tracking-[-0.04em] sm:text-2xl">
              {nextStep.title}
            </h2>
            <p className="mt-1 text-sm leading-5 text-kindly-muted">{nextStep.body}</p>
          </div>
          <button
            type="button"
            onClick={() => selectTab(nextStep.tab)}
            className="kindly-btn-primary shrink-0"
          >
            {nextStep.action} <Icon name="arrow-right" className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => selectTab("account")}
            className="kindly-card min-w-0 p-3 text-left transition hover:border-kindly-accent"
          >
            <span className="kindly-eyebrow">UPI</span>
            <strong className="mt-1 block truncate font-display text-lg font-bold tracking-[-0.04em]">
              {paymentMethod ? "Ready" : "Add"}
            </strong>
            <span className="mt-0.5 block truncate text-[11px] text-kindly-muted">
              {paymentMethod?.maskedVpa ?? "Private payment address"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => selectTab("wish")}
            className="kindly-card min-w-0 p-3 text-left transition hover:border-kindly-accent"
          >
            <span className="kindly-eyebrow">Wish</span>
            <strong className="mt-1 block font-display text-lg font-bold tracking-[-0.04em]">
              {activeWish ? "Live" : cooldownUntil ? "Paused" : "None"}
            </strong>
            <span className="mt-0.5 block truncate text-[11px] text-kindly-muted">
              {activeWish
                ? moodLabel(activeWish.mood)
                : cooldownUntil
                  ? "Cooldown"
                  : "One at a time"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => selectTab("gifts")}
            className="kindly-card min-w-0 p-3 text-left transition hover:border-kindly-accent"
          >
            <span className="kindly-eyebrow">Gifts</span>
            <strong className="mt-1 block font-display text-lg font-bold tracking-[-0.04em]">
              {gifts.length}
            </strong>
            <span className="mt-0.5 block truncate text-[11px] text-kindly-muted">
              {confirmedGifts.length} confirmed
            </span>
          </button>
          <button
            type="button"
            onClick={() => selectTab("gifts")}
            className="kindly-card min-w-0 p-3 text-left transition hover:border-kindly-accent"
          >
            <span className="kindly-eyebrow">Badges</span>
            <strong className="mt-1 block font-display text-lg font-bold tracking-[-0.04em]">
              {badgeCount}
            </strong>
            <span className="mt-0.5 block truncate text-[11px] text-kindly-muted">
              No cash value
            </span>
          </button>
        </div>

        {karma && (
          <section aria-labelledby="karma-heading" className="kindly-card p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2
                  id="karma-heading"
                  className="font-display text-xl font-semibold tracking-[-0.04em] sm:text-2xl"
                >
                  Karma & badges
                </h2>
                <p className="mt-1 text-xs leading-5 text-kindly-muted">
                  Derived from the immutable ledger. No cash value or redemption.
                </p>
              </div>
              <button
                type="button"
                onClick={() => selectTab("gifts")}
                className="kindly-btn-quiet !min-h-8 !px-2 !text-xs"
              >
                Gift history
              </button>
            </div>
            {karma.badges.length === 0 && karma.events.length === 0 ? (
              <p className="kindly-card-soft mt-3 p-3 text-sm leading-5 text-kindly-muted">
                Your first confirmed gift starts your little badge collection. No pressure — just
                because is enough.
              </p>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {karma.badges.length > 0 && (
                  <ul className="flex flex-wrap content-start gap-1.5">
                    {karma.badges.map((badge) => (
                      <li
                        key={badge.badgeCode}
                        className="rounded-full bg-kindly-accent-soft px-2.5 py-1 text-xs font-semibold text-kindly-accent"
                      >
                        {badge.label}
                      </li>
                    ))}
                  </ul>
                )}
                {karma.events.length > 0 && (
                  <ul className="space-y-1.5 text-xs">
                    {karma.events.slice(0, 4).map((event) => (
                      <li key={event.id} className="flex justify-between gap-3">
                        <span>{KARMA_EVENT_LABELS[event.eventType] ?? event.eventType}</span>
                        <span className="font-semibold text-kindly-accent">
                          {event.pointsDelta > 0 ? "+" : ""}
                          {event.pointsDelta}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        )}

        <section aria-labelledby="recent-gifts-heading" className="kindly-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2
              id="recent-gifts-heading"
              className="font-display text-xl font-semibold tracking-[-0.04em] sm:text-2xl"
            >
              Recent gifts
            </h2>
            {gifts.length > 0 && (
              <button
                type="button"
                onClick={() => selectTab("gifts")}
                className="kindly-btn-quiet !min-h-8 !px-2 !text-xs"
              >
                View all
              </button>
            )}
          </div>
          {gifts.length === 0 ? (
            <p className="mt-2 text-sm leading-6 text-kindly-muted">
              No gifts yet. Send a little something from Discover, or share a wish of your own.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {gifts.slice(0, 3).map((gift) => (
                <li key={gift.giftId}>
                  <Link
                    href={`/gifts/${gift.giftId}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-kindly-border/70 bg-kindly-cream/50 px-3 py-2.5 text-sm hover:border-kindly-accent"
                  >
                    <span className="min-w-0">
                      <span className="font-semibold">₹{gift.amountInr}</span>{" "}
                      <span className="text-kindly-muted">
                        {gift.viewerRole === "DONOR" ? "sent" : "received"}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-kindly-accent">
                      {giftStatusLabel(gift.giftStatus)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>

      <section
        id="space-panel-wish"
        role="tabpanel"
        aria-labelledby="space-tab-wish"
        hidden={tab !== "wish"}
        className="space-y-4"
      >
        {activeWish && (
          <section aria-labelledby="active-wish-heading" className="kindly-card p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="kindly-eyebrow">One wish at a time</p>
                <h2
                  id="active-wish-heading"
                  className="mt-1 font-display text-xl font-semibold tracking-[-0.04em] sm:text-2xl"
                >
                  Your active wish
                </h2>
              </div>
              <span className="kindly-chip">
                <Icon name="sun" className="h-3 w-3" />{" "}
                {activeWish.status === "LOCKED" ? "Locked" : "Live"}
              </span>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              <p className="text-base leading-6">{activeWish.message}</p>
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
                className="kindly-btn-secondary"
              >
                {busy ? "Withdrawing…" : "Withdraw wish"}
              </button>
            </div>
          </section>
        )}

        {!activeWish && cooldownUntil && (
          <section className="kindly-card-soft p-4 text-sm sm:p-5">
            <h2 className="font-display text-xl font-semibold tracking-[-0.04em] sm:text-2xl">
              Cooldown
            </h2>
            <p className="mt-2 text-kindly-muted">
              You can publish another wish after {formatDate(cooldownUntil.toISOString())}.
            </p>
          </section>
        )}

        <section aria-labelledby="create-wish-heading" className="kindly-card p-4 sm:p-5">
          <h2
            id="create-wish-heading"
            className="font-display text-xl font-semibold tracking-[-0.04em] sm:text-2xl"
          >
            Create a wish
          </h2>

          {!paymentMethod && (
            <div className="kindly-card-soft mt-3 flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <p className="text-kindly-muted">Add your UPI ID before publishing a wish.</p>
              <button
                type="button"
                onClick={() => selectTab("account")}
                className="kindly-btn-secondary !min-h-9"
              >
                Go to Account
              </button>
            </div>
          )}

          {paymentMethod && !canPublish && (
            <p className="mt-2 text-sm text-kindly-muted">
              You can publish again after your active wish or cooldown ends.
            </p>
          )}

          {canPublish && (
            <form className="mt-3 space-y-3" onSubmit={handleCreateWish}>
              <div>
                <label htmlFor="wish-message" className="kindly-label">
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
                  className="kindly-input mt-1"
                  aria-describedby="wish-message-help"
                />
                <p id="wish-message-help" className="kindly-help">
                  {charCount}/120 characters. No links, phone numbers, UPI IDs or HTML.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="wish-mood" className="kindly-label">
                    Mood
                  </label>
                  <select
                    id="wish-mood"
                    value={mood}
                    onChange={(event) => setMood(event.target.value as WishMood)}
                    className="kindly-input mt-1"
                  >
                    {MOODS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="wish-amount" className="kindly-label">
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
                    className="kindly-input mt-1"
                    placeholder="₹10–₹100"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="wish-city" className="kindly-label">
                  City (optional)
                </label>
                <input
                  id="wish-city"
                  name="city"
                  type="text"
                  maxLength={60}
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  className="kindly-input mt-1"
                />
              </div>

              <div className="kindly-card-soft p-3 text-sm">
                <p className="text-[10px] font-extrabold tracking-[0.14em] text-kindly-accent uppercase">
                  Preview
                </p>
                <p className="mt-1.5">{message || "Your wish message will appear here."}</p>
                <p className="mt-0.5 text-kindly-muted">
                  {moodLabel(mood)}
                  {amount ? ` · suggested ₹${amount}` : " · donor chooses amount"}
                  {city ? ` · ${city}` : ""}
                </p>
              </div>

              <button type="submit" disabled={busy} className="kindly-btn-primary">
                {busy ? "Publishing…" : "Publish wish"}
              </button>
            </form>
          )}
        </section>

        <section aria-labelledby="history-heading">
          <div className="flex items-center justify-between gap-3">
            <h2
              id="history-heading"
              className="font-display text-xl font-semibold tracking-[-0.04em] sm:text-2xl"
            >
              Wish history
            </h2>
            <span className="text-xs font-semibold text-kindly-muted">
              {wishes.length} {wishes.length === 1 ? "wish" : "wishes"}
            </span>
          </div>
          {wishes.length === 0 ? (
            <p className="mt-2 text-sm text-kindly-muted">No wishes yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {wishes.map((wish) => (
                <li key={wish.id} className="kindly-card p-3.5 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full bg-kindly-accent-soft px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-kindly-accent uppercase">
                      {wish.status}
                    </span>
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
      </section>

      <section
        id="space-panel-gifts"
        role="tabpanel"
        aria-labelledby="space-tab-gifts"
        hidden={tab !== "gifts"}
        className="space-y-4"
      >
        <section aria-labelledby="gift-history-heading">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="kindly-eyebrow">Little things add up</p>
              <h2
                id="gift-history-heading"
                className="mt-1 font-display text-2xl font-semibold tracking-[-0.04em]"
              >
                Gift history
              </h2>
            </div>
            <span className="text-xs font-semibold text-kindly-muted">
              {gifts.length} total · {confirmedGifts.length} confirmed
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-kindly-muted">
            Statuses are attestations: the donor says they paid, and the recipient confirms what
            arrived. Kindly does not hold or verify the money.
          </p>
          {gifts.length === 0 ? (
            <p className="kindly-card mt-3 p-4 text-sm text-kindly-muted">No gifts yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {gifts.map((gift) => (
                <li key={gift.giftId}>
                  <Link
                    href={`/gifts/${gift.giftId}`}
                    className="kindly-card block p-4 text-sm hover:border-kindly-accent"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-display text-lg font-bold tracking-[-0.04em]">
                        ₹{gift.amountInr}
                      </span>
                      <span className="text-xs font-semibold text-kindly-accent">
                        {giftStatusLabel(gift.giftStatus)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-kindly-muted">
                      {gift.viewerRole === "DONOR"
                        ? `You sent this to ${gift.recipientDisplayName ?? "a recipient"}.`
                        : "A kind donor sent this to you."}
                    </p>
                    <p className="kindly-help">
                      {formatDate(gift.createdAt)} · reference {gift.paymentRefCode}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>

      <section
        id="space-panel-account"
        role="tabpanel"
        aria-labelledby="space-tab-account"
        hidden={tab !== "account"}
        className="space-y-4"
      >
        <section aria-labelledby="payment-method-heading" className="kindly-card p-4 sm:p-5">
          <h2
            id="payment-method-heading"
            className="font-display text-xl font-semibold tracking-[-0.04em] sm:text-2xl"
          >
            Receiving UPI ID
          </h2>

          {paymentMethod && !editingVpa ? (
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-display text-lg font-bold">{paymentMethod.maskedVpa}</p>
                <span className="kindly-chip">
                  <Icon name="lock" className="h-3 w-3" /> Private
                </span>
              </div>
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
                className="kindly-btn-secondary"
              >
                Change UPI ID
              </button>
            </div>
          ) : (
            <form className="mt-3 space-y-3" onSubmit={handleSaveVpa}>
              <div>
                <label htmlFor="vpa" className="kindly-label">
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
                  className="kindly-input mt-1"
                  aria-describedby="vpa-help"
                />
                <p id="vpa-help" className="kindly-help">
                  We check the format only. We cannot verify ownership or that the UPI ID can
                  receive money.
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
              <button type="submit" disabled={busy} className="kindly-btn-primary">
                {busy ? "Saving…" : "Save UPI ID"}
              </button>
            </form>
          )}
        </section>

        <section aria-labelledby="account-links-heading" className="kindly-card p-4 sm:p-5">
          <h2
            id="account-links-heading"
            className="font-display text-xl font-semibold tracking-[-0.04em] sm:text-2xl"
          >
            Account & support
          </h2>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <Link
              href="/appeals"
              className="rounded-xl border border-kindly-border bg-kindly-cream/50 px-3 py-2.5 font-semibold hover:border-kindly-accent"
            >
              Appeals
            </Link>
            <Link
              href="/account-deletion"
              className="rounded-xl border border-kindly-border bg-kindly-cream/50 px-3 py-2.5 font-semibold hover:border-kindly-accent"
            >
              Account deletion
            </Link>
          </div>
          <p className="mt-3 text-xs leading-5 text-kindly-muted">
            Deletion requests are reviewed. No financial or audit record is erased automatically.
          </p>
        </section>

        {blocks.length > 0 && (
          <section aria-labelledby="blocked-accounts-heading">
            <h2
              id="blocked-accounts-heading"
              className="font-display text-xl font-semibold tracking-[-0.04em] sm:text-2xl"
            >
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
                    className="kindly-card flex flex-wrap items-center justify-between gap-3 p-3.5 text-sm"
                  >
                    <span className="font-semibold">{name}</span>
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`Unblock ${name}`}
                      onClick={() => handleUnblock(block.blockedUserId)}
                      className="kindly-btn-secondary !min-h-9"
                    >
                      Unblock
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </section>
    </div>
  );
}
