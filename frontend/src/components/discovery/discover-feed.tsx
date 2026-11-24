"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import { ApiError } from "@/lib/api/client";
import { listPublicWishes, surpriseMe, type PublicWish } from "@/lib/api/discovery";
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

const AVATAR_TONES = [
  "bg-kindly-blush text-kindly-ink",
  "bg-kindly-accent-soft text-kindly-accent",
  "bg-kindly-sky text-kindly-ink",
  "bg-kindly-marigold/35 text-kindly-ink",
];

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function toneFor(name: string): string {
  const total = [...name].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return AVATAR_TONES[total % AVATAR_TONES.length];
}

type FeedResultsProps = {
  sort: "fresh" | "random";
  onRetry: () => void;
};

function FeedResults({ sort, onRetry }: FeedResultsProps) {
  const [wishes, setWishes] = useState<PublicWish[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [seed, setSeed] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    listPublicWishes({
      sort,
      limit: 6,
    })
      .then((page) => {
        if (!cancelled) {
          setWishes(page.wishes);
          setCursor(page.nextCursor);
          setSeed(page.seed);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof ApiError ? loadError.message : "Could not load wishes.");
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
  }, [sort]);

  async function loadMore() {
    if (!cursor || loadingMore) {
      return;
    }
    setLoadingMore(true);
    setError(null);
    try {
      const page = await listPublicWishes({
        sort,
        cursor,
        seed: seed ?? undefined,
        limit: 6,
      });
      setWishes((current) => [...current, ...page.wishes]);
      setCursor(page.nextCursor);
      setSeed(page.seed ?? seed);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : "Could not load more wishes.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <>
      <div aria-live="polite" className="text-sm text-kindly-muted">
        {loading && (
          <p className="rounded-[1.4rem] border border-kindly-border bg-kindly-card p-5">
            Loading little wishes…
          </p>
        )}
        {error && (
          <div role="alert" className="rounded-[1.4rem] bg-red-50 p-4 text-red-700">
            <p>{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 font-semibold underline underline-offset-4"
            >
              Try again
            </button>
          </div>
        )}
      </div>

      {!loading && !error && wishes.length === 0 && (
        <div className="rounded-[1.4rem] border border-kindly-border bg-kindly-card p-6 text-sm text-kindly-muted">
          No wishes are open right now. Check back shortly.
        </div>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {wishes.map((wish) => (
          <li key={wish.id}>
            <Link
              href={`/wishes/${wish.id}`}
              className="group flex h-full flex-col rounded-[1.4rem] border border-kindly-border bg-kindly-card p-5 shadow-[0_2px_0_rgb(23_59_51_/_4%)] transition duration-200 hover:-translate-y-0.5 hover:border-kindly-accent/60 hover:shadow-[0_8px_24px_rgb(23_59_51_/_8%)]"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold ${toneFor(
                    wish.displayName,
                  )}`}
                >
                  {wish.displayName.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{wish.displayName}</p>
                  <p className="mt-0.5 truncate text-[11px] text-kindly-muted">
                    {wish.city ? `${wish.city} · ` : ""}
                    {formatDate(wish.createdAt)}
                  </p>
                </div>
              </div>
              <p className="mt-5 flex-1 font-display text-[1.35rem] leading-[1.04] font-semibold tracking-[-0.045em]">
                {wish.message}
              </p>
              <div className="mt-5 flex items-center justify-between gap-2 border-t border-kindly-border/70 pt-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-kindly-accent-soft px-2.5 py-1 text-[10px] font-extrabold text-kindly-accent">
                  <Icon name={MOOD_ICONS[wish.mood]} className="h-3 w-3" />
                  {MOOD_LABELS[wish.mood]}
                </span>
                {wish.suggestedAmountInr ? (
                  <span className="font-display text-lg font-bold tracking-[-0.04em] text-kindly-coral">
                    ₹{wish.suggestedAmountInr}{" "}
                    <span className="font-sans text-[9px] font-semibold tracking-normal text-kindly-muted">
                      suggested
                    </span>
                  </span>
                ) : (
                  <span className="text-xs font-bold text-kindly-accent">You choose</span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {cursor && (
        <div className="text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-kindly-border bg-kindly-card px-5 py-3 text-sm font-bold text-kindly-ink hover:bg-kindly-accent-soft disabled:opacity-60"
          >
            {loadingMore ? "Loading…" : "Load more wishes"}
          </button>
        </div>
      )}
    </>
  );
}

export function DiscoverFeed() {
  const router = useRouter();
  const { user } = useSessionUser();
  const sessionReady = user !== undefined;
  const [sort, setSort] = useState<"fresh" | "random">("fresh");
  const [reloadKey, setReloadKey] = useState(0);
  const [surpriseBusy, setSurpriseBusy] = useState(false);
  const [surpriseError, setSurpriseError] = useState<string | null>(null);
  const [surpriseNeedsAuth, setSurpriseNeedsAuth] = useState(false);

  async function handleSurprise() {
    setSurpriseBusy(true);
    setSurpriseError(null);
    setSurpriseNeedsAuth(false);
    let skipped: string[] = [];
    try {
      const raw = sessionStorage.getItem("kindly:surprise-skips");
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          skipped = parsed.filter((value): value is string => typeof value === "string");
        }
      }
    } catch {
      skipped = [];
    }
    try {
      const wish = await surpriseMe(skipped);
      sessionStorage.setItem(
        "kindly:surprise-skips",
        JSON.stringify([...skipped, wish.id].slice(-50)),
      );
      router.push(`/wishes/${wish.id}`);
    } catch (surpriseLoadError) {
      if (surpriseLoadError instanceof ApiError) {
        if (surpriseLoadError.status === 401) {
          setSurpriseNeedsAuth(true);
        } else {
          setSurpriseError(surpriseLoadError.message);
        }
      } else {
        setSurpriseError("Could not pick a surprise wish.");
      }
    } finally {
      setSurpriseBusy(false);
    }
  }

  return (
    <section id="open-wishes" aria-labelledby="discover-heading" className="space-y-5 sm:space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-extrabold tracking-[0.18em] text-kindly-accent uppercase">
            Out in the world
          </p>
          <h2
            id="discover-heading"
            className="mt-1.5 font-display text-3xl font-semibold tracking-[-0.05em] sm:text-4xl"
          >
            Little wishes, right now
          </h2>
          <p className="mt-2 text-sm leading-6 text-kindly-muted">
            Browse freely. Sign in only when you want to take part.
          </p>
        </div>
        <div className="flex gap-1 rounded-full border border-kindly-border bg-kindly-card p-1">
          <button
            type="button"
            onClick={() => setSort("fresh")}
            aria-pressed={sort === "fresh"}
            className={`min-h-9 rounded-full px-4 py-1.5 text-xs font-bold ${
              sort === "fresh"
                ? "bg-kindly-accent text-white shadow-sm"
                : "text-kindly-muted hover:bg-kindly-accent-soft"
            }`}
          >
            Fresh
          </button>
          <button
            type="button"
            onClick={() => setSort("random")}
            aria-pressed={sort === "random"}
            className={`min-h-9 rounded-full px-4 py-1.5 text-xs font-bold ${
              sort === "random"
                ? "bg-kindly-accent text-white shadow-sm"
                : "text-kindly-muted hover:bg-kindly-accent-soft"
            }`}
          >
            Random
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-[1.5rem] border border-kindly-border bg-kindly-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-kindly-marigold/35 text-kindly-ink">
            <Icon name="sparkle" className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-lg font-semibold tracking-[-0.035em]">
              Feeling spontaneous?
            </p>
            <p className="mt-0.5 text-sm leading-6 text-kindly-muted">
              Let us pick one little wish for you. You can skip and try again.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={surpriseBusy || !sessionReady}
          onClick={handleSurprise}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-kindly-accent px-5 py-3 text-sm font-bold text-white shadow-[0_4px_0_rgb(23_59_51_/_13%)] hover:bg-kindly-accent-dark disabled:opacity-60"
        >
          {surpriseBusy ? "Choosing…" : "Surprise me"}
          <Icon name="sparkle" className="h-4 w-4" />
        </button>
      </div>

      {surpriseNeedsAuth && (
        <p className="text-sm">
          <Link
            href="/sign-in"
            className="font-semibold text-kindly-accent underline underline-offset-4"
          >
            Sign in to use Surprise Me
          </Link>
        </p>
      )}
      {surpriseError && (
        <p role="alert" className="rounded-[1.4rem] bg-red-50 p-4 text-sm text-red-700">
          {surpriseError}
        </p>
      )}

      {sessionReady ? (
        <FeedResults
          key={`${sort}|${reloadKey}|${user?.id ?? "guest"}`}
          sort={sort}
          onRetry={() => setReloadKey((current) => current + 1)}
        />
      ) : (
        <p aria-live="polite" className="text-sm text-kindly-muted">
          Loading little wishes…
        </p>
      )}
    </section>
  );
}
