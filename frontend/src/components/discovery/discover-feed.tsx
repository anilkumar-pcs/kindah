"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import { ApiError } from "@/lib/api/client";
import {
  listPublicWishes,
  surpriseMe,
  type FeedParams,
  type PublicWish,
} from "@/lib/api/discovery";
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

const MOOD_OPTIONS: Array<{ value: WishMood; label: string }> = [
  { value: "CHAI_SNACK", label: MOOD_LABELS.CHAI_SNACK },
  { value: "JUST_BECAUSE", label: MOOD_LABELS.JUST_BECAUSE },
  { value: "LONG_DAY", label: MOOD_LABELS.LONG_DAY },
  { value: "TINY_TREAT", label: MOOD_LABELS.TINY_TREAT },
];

type AmountBand = "any" | "10-25" | "26-50" | "51-100";

const AMOUNT_BANDS: Array<{
  value: AmountBand;
  label: string;
  min?: number;
  max?: number;
}> = [
  { value: "any", label: "Any amount" },
  { value: "10-25", label: "₹10–₹25", min: 10, max: 25 },
  { value: "26-50", label: "₹26–₹50", min: 26, max: 50 },
  { value: "51-100", label: "₹51–₹100", min: 51, max: 100 },
];

const AVATAR_TONES = [
  "bg-kindly-blush text-kindly-ink",
  "bg-kindly-accent-soft text-kindly-accent",
  "bg-kindly-sky text-kindly-ink",
  "bg-kindly-marigold/35 text-kindly-ink",
];

type FeedFilters = {
  q: string;
  mood: WishMood | "";
  amountBand: AmountBand;
  sort: "fresh" | "random";
};

const EMPTY_FILTERS: FeedFilters = {
  q: "",
  mood: "",
  amountBand: "any",
  sort: "fresh",
};

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

function isWishMood(value: string | null): value is WishMood {
  return value !== null && value in MOOD_LABELS;
}

function isAmountBand(value: string | null): value is AmountBand {
  return AMOUNT_BANDS.some((band) => band.value === value);
}

function amountRange(band: AmountBand): { min?: number; max?: number } {
  return AMOUNT_BANDS.find((item) => item.value === band) ?? AMOUNT_BANDS[0];
}

function filtersFromLocation(): FeedFilters {
  const params = new URLSearchParams(window.location.search);
  const mood = params.get("mood");
  const amountBand = params.get("amount");
  return {
    q: (params.get("q") ?? "").slice(0, 80),
    mood: isWishMood(mood) ? mood : "",
    amountBand: isAmountBand(amountBand) ? amountBand : "any",
    sort: params.get("sort") === "random" ? "random" : "fresh",
  };
}

function queryStringFor(filters: FeedFilters): string {
  const params = new URLSearchParams();
  if (filters.q) {
    params.set("q", filters.q);
  }
  if (filters.mood) {
    params.set("mood", filters.mood);
  }
  if (filters.amountBand !== "any") {
    params.set("amount", filters.amountBand);
  }
  if (filters.sort === "random") {
    params.set("sort", "random");
  }
  return params.toString();
}

function toParams(
  filters: FeedFilters,
  extra: { cursor?: string; seed?: string } = {},
): FeedParams {
  const band = amountRange(filters.amountBand);
  const params: FeedParams = {
    sort: filters.sort,
    limit: 6,
    ...extra,
  };
  if (filters.q) {
    params.q = filters.q;
  }
  if (filters.mood) {
    params.mood = filters.mood;
  }
  if (band.min !== undefined) {
    params.amountMin = band.min;
  }
  if (band.max !== undefined) {
    params.amountMax = band.max;
  }
  return params;
}

function filterKey(filters: FeedFilters): string {
  return `${filters.sort}|${filters.q}|${filters.mood}|${filters.amountBand}`;
}

type FeedResultsProps = {
  filters: FeedFilters;
  onRetry: () => void;
};

function FeedResults({ filters, onRetry }: FeedResultsProps) {
  const [wishes, setWishes] = useState<PublicWish[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [seed, setSeed] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { q, mood, amountBand, sort } = filters;
  const hasFilters = Boolean(q || mood || amountBand !== "any");

  useEffect(() => {
    let cancelled = false;
    const requestFilters: FeedFilters = { q, mood, amountBand, sort };

    listPublicWishes(toParams(requestFilters))
      .then((page) => {
        if (!cancelled) {
          setError(null);
          setWishes(page.wishes);
          setCursor(page.nextCursor);
          setSeed(page.seed);
          setTotalCount(page.totalCount);
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
  }, [q, mood, amountBand, sort]);

  async function loadMore() {
    if (!cursor || loadingMore) {
      return;
    }
    setLoadingMore(true);
    setError(null);
    try {
      const page = await listPublicWishes(toParams(filters, { cursor, seed: seed ?? undefined }));
      setWishes((current) => [...current, ...page.wishes]);
      setCursor(page.nextCursor);
      setSeed(page.seed ?? seed);
      setTotalCount(page.totalCount);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : "Could not load more wishes.");
    } finally {
      setLoadingMore(false);
    }
  }

  const remaining = Math.max(totalCount - wishes.length, 0);

  return (
    <>
      <div aria-live="polite" className="text-sm text-kindly-muted">
        {loading && (
          <p className="rounded-[1.4rem] border border-kindly-border bg-kindly-card p-5">
            Finding little wishes…
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

      {!loading && !error && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-kindly-muted">
          <p>
            Showing {wishes.length} of {totalCount} {totalCount === 1 ? "wish" : "wishes"}
          </p>
          {hasFilters && <p className="text-kindly-accent">Filtered results</p>}
        </div>
      )}

      {!loading && !error && wishes.length === 0 && (
        <div className="rounded-[1.4rem] border border-kindly-border bg-kindly-card p-6 text-sm text-kindly-muted">
          {hasFilters
            ? "No wishes matched. Try a wider search, another mood or a different amount."
            : "No wishes are open right now. Check back shortly."}
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
            {loadingMore
              ? "Loading…"
              : remaining > 0
                ? `Load more wishes (${remaining} left)`
                : "Load more wishes"}
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
  const [filtersReady, setFiltersReady] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const [filters, setFilters] = useState<FeedFilters>(EMPTY_FILTERS);
  const [reloadKey, setReloadKey] = useState(0);
  const [surpriseBusy, setSurpriseBusy] = useState(false);
  const [surpriseError, setSurpriseError] = useState<string | null>(null);
  const [surpriseNeedsAuth, setSurpriseNeedsAuth] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const initial = filtersFromLocation();
    queueMicrotask(() => {
      if (!cancelled) {
        setFilters(initial);
        setSearchDraft(initial.q);
        setFiltersReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!filtersReady) {
      return;
    }
    const query = queryStringFor(filters);
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [filters, filtersReady]);

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters((current) => ({ ...current, q: searchDraft.trim().slice(0, 80) }));
  }

  function clearFilters() {
    setSearchDraft("");
    setFilters(EMPTY_FILTERS);
  }

  const activeFilterCount = [
    filters.q ? "q" : "",
    filters.mood ? "mood" : "",
    filters.amountBand !== "any" ? "amount" : "",
  ].filter(Boolean).length;

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-extrabold tracking-[0.18em] text-kindly-accent uppercase">
            Out in the world
          </p>
          <h1
            id="discover-heading"
            className="mt-1 font-display text-3xl font-semibold tracking-[-0.05em] sm:text-4xl"
          >
            Little wishes, right now
          </h1>
          <p className="mt-1.5 text-sm leading-6 text-kindly-muted">
            Browse freely. Sign in to take part.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex gap-1 rounded-full border border-kindly-border bg-kindly-card p-1">
            <button
              type="button"
              onClick={() => setFilters((current) => ({ ...current, sort: "fresh" }))}
              aria-pressed={filters.sort === "fresh"}
              className={`min-h-8 rounded-full px-3 py-1 text-xs font-bold ${
                filters.sort === "fresh"
                  ? "bg-kindly-accent text-white shadow-sm"
                  : "text-kindly-muted hover:bg-kindly-accent-soft"
              }`}
            >
              Fresh
            </button>
            <button
              type="button"
              onClick={() => setFilters((current) => ({ ...current, sort: "random" }))}
              aria-pressed={filters.sort === "random"}
              className={`min-h-8 rounded-full px-3 py-1 text-xs font-bold ${
                filters.sort === "random"
                  ? "bg-kindly-accent text-white shadow-sm"
                  : "text-kindly-muted hover:bg-kindly-accent-soft"
              }`}
            >
              Random
            </button>
          </div>
          <button
            type="button"
            disabled={surpriseBusy || !sessionReady}
            onClick={handleSurprise}
            className="kindly-btn-secondary !min-h-9 !px-3 !text-xs"
          >
            {surpriseBusy ? "Choosing…" : "Surprise me"}
            <Icon name="sparkle" className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-kindly-border bg-kindly-card p-2">
        <form
          onSubmit={applySearch}
          role="search"
          aria-label="Search and filter wishes"
          className="flex items-center gap-1.5"
        >
          <div className="min-w-0 flex-1">
            <label htmlFor="wish-search" className="sr-only">
              Search wishes or pseudonyms
            </label>
            <input
              id="wish-search"
              type="search"
              maxLength={80}
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search wishes"
              className="kindly-input !min-h-10 !py-2 text-sm"
            />
          </div>
          <button type="submit" className="kindly-btn-secondary !min-h-10 !px-3">
            Search
          </button>
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-2xl border px-3 text-xs font-bold ${
              activeFilterCount > 0
                ? "border-kindly-accent bg-kindly-accent-soft text-kindly-accent"
                : "border-kindly-border bg-kindly-card text-kindly-muted"
            }`}
          >
            Filters
            {activeFilterCount > 0 && (
              <span className="grid h-4 min-w-4 place-items-center rounded-full bg-kindly-accent px-1 text-[9px] text-white">
                {activeFilterCount}
              </span>
            )}
            <Icon
              name="chevron-down"
              className={`h-3.5 w-3.5 transition-transform ${filtersOpen ? "rotate-180" : ""}`}
            />
          </button>
        </form>

        {filtersOpen && (
          <div className="mt-2 space-y-2 border-t border-kindly-border/70 px-1 pt-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[10px] font-extrabold tracking-[0.12em] text-kindly-muted uppercase">
                Mood
              </span>
              <button
                type="button"
                aria-pressed={filters.mood === ""}
                onClick={() => setFilters((current) => ({ ...current, mood: "" }))}
                className={`min-h-8 rounded-full px-2.5 text-xs font-bold ${
                  filters.mood === ""
                    ? "bg-kindly-accent text-white"
                    : "border border-kindly-border bg-kindly-cream/60 text-kindly-muted"
                }`}
              >
                All
              </button>
              {MOOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={filters.mood === option.value}
                  onClick={() => setFilters((current) => ({ ...current, mood: option.value }))}
                  className={`min-h-8 rounded-full px-2.5 text-xs font-bold ${
                    filters.mood === option.value
                      ? "bg-kindly-accent text-white"
                      : "border border-kindly-border bg-kindly-cream/60 text-kindly-muted"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor="amount-band"
                className="text-[10px] font-extrabold tracking-[0.12em] text-kindly-muted uppercase"
              >
                Amount
              </label>
              <select
                id="amount-band"
                value={filters.amountBand}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    amountBand: event.target.value as AmountBand,
                  }))
                }
                className="kindly-input !min-h-9 !w-auto !py-1.5 text-xs"
              >
                {AMOUNT_BANDS.map((band) => (
                  <option key={band.value} value={band.value}>
                    {band.label}
                  </option>
                ))}
              </select>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="min-h-8 text-xs font-bold text-kindly-muted underline underline-offset-4 hover:text-kindly-accent"
                >
                  Clear {activeFilterCount === 1 ? "filter" : "filters"}
                </button>
              )}
            </div>
          </div>
        )}

        {activeFilterCount > 0 && !filtersOpen && (
          <div className="mt-1.5 flex justify-end px-1">
            <button
              type="button"
              onClick={clearFilters}
              className="min-h-7 text-[11px] font-bold text-kindly-muted underline underline-offset-4 hover:text-kindly-accent"
            >
              Clear {activeFilterCount === 1 ? "filter" : "filters"}
            </button>
          </div>
        )}
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

      {filtersReady && sessionReady ? (
        <FeedResults
          key={`${filterKey(filters)}|${reloadKey}|${user?.id ?? "guest"}`}
          filters={filters}
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
