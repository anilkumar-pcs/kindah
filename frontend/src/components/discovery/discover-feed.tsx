"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { ApiError } from "@/lib/api/client";
import { listPublicWishes, surpriseMe, type PublicWish } from "@/lib/api/discovery";
import type { WishMood } from "@/lib/api/wishes";

const MOOD_LABELS: Record<WishMood, string> = {
  CHAI_SNACK: "Chai & snack",
  JUST_BECAUSE: "Just because",
  LONG_DAY: "Long day",
  TINY_TREAT: "Tiny treat",
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

type FeedResultsProps = {
  sort: "fresh" | "random";
  city: string;
  onRetry: () => void;
};

function FeedResults({ sort, city, onRetry }: FeedResultsProps) {
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
      city: city || undefined,
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
  }, [sort, city]);

  async function loadMore() {
    if (!cursor || loadingMore) {
      return;
    }
    setLoadingMore(true);
    setError(null);
    try {
      const page = await listPublicWishes({
        sort,
        city: city || undefined,
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
        {loading && <p>Loading open wishes…</p>}
        {error && (
          <div role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">
            <p>{error}</p>
            <button type="button" onClick={onRetry} className="mt-2 font-semibold underline">
              Try again
            </button>
          </div>
        )}
      </div>

      {!loading && !error && wishes.length === 0 && (
        <div className="rounded-2xl border border-kindly-border bg-white p-6 text-sm text-kindly-muted">
          No wishes are open right now. Check back shortly.
        </div>
      )}

      <ul className="grid gap-4 sm:grid-cols-2">
        {wishes.map((wish) => (
          <li key={wish.id}>
            <Link
              href={`/wishes/${wish.id}`}
              className="block h-full rounded-2xl border border-kindly-border bg-white p-5 hover:border-kindly-accent"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-kindly-accent-soft font-semibold text-kindly-accent"
                >
                  {wish.displayName.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <p className="font-semibold">{wish.displayName}</p>
                  <p className="text-xs text-kindly-muted">
                    {wish.city ? `${wish.city} · ` : ""}
                    {formatDate(wish.createdAt)}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-base leading-6">{wish.message}</p>
              <p className="mt-3 text-sm text-kindly-muted">
                {MOOD_LABELS[wish.mood]}
                {" · "}
                {wish.suggestedAmountInr
                  ? `suggested ₹${wish.suggestedAmountInr}`
                  : "donor chooses amount"}
              </p>
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
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-kindly-border bg-white px-5 py-3 text-sm font-semibold hover:bg-kindly-accent-soft disabled:opacity-60"
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
  const [sort, setSort] = useState<"fresh" | "random">("fresh");
  const [cityInput, setCityInput] = useState("");
  const [city, setCity] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [surpriseBusy, setSurpriseBusy] = useState(false);
  const [surpriseError, setSurpriseError] = useState<string | null>(null);
  const [surpriseNeedsAuth, setSurpriseNeedsAuth] = useState(false);

  function applyCity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCity(cityInput.trim());
  }

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

  function clearCity() {
    setCityInput("");
    setCity("");
  }

  return (
    <section aria-labelledby="discover-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="discover-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
            Open wishes
          </h2>
          <p className="mt-1 text-sm text-kindly-muted">
            Browse anonymously. Sign in before selecting a wish.
          </p>
        </div>
        <div className="flex gap-1 rounded-xl border border-kindly-border bg-white p-1">
          <button
            type="button"
            onClick={() => setSort("fresh")}
            aria-pressed={sort === "fresh"}
            className={`min-h-9 rounded-lg px-3 py-1 text-sm font-medium ${
              sort === "fresh"
                ? "bg-kindly-accent text-white"
                : "text-kindly-muted hover:bg-kindly-accent-soft"
            }`}
          >
            Fresh
          </button>
          <button
            type="button"
            onClick={() => setSort("random")}
            aria-pressed={sort === "random"}
            className={`min-h-9 rounded-lg px-3 py-1 text-sm font-medium ${
              sort === "random"
                ? "bg-kindly-accent text-white"
                : "text-kindly-muted hover:bg-kindly-accent-soft"
            }`}
          >
            Random
          </button>
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-2" onSubmit={applyCity}>
        <div className="min-w-48 flex-1">
          <label htmlFor="city-filter" className="block text-sm font-medium">
            City filter
          </label>
          <input
            id="city-filter"
            type="text"
            value={cityInput}
            onChange={(event) => setCityInput(event.target.value)}
            placeholder="Bengaluru"
            className="mt-1 min-h-11 w-full rounded-xl border border-kindly-border bg-white px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-kindly-border bg-white px-4 py-2 text-sm font-semibold hover:bg-kindly-accent-soft"
        >
          Apply
        </button>
        {city && (
          <button
            type="button"
            onClick={clearCity}
            className="inline-flex min-h-11 items-center justify-center rounded-xl px-3 py-2 text-sm font-medium text-kindly-muted underline"
          >
            Clear city
          </button>
        )}
      </form>

      <div className="rounded-2xl border border-kindly-border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">Surprise me</p>
            <p className="text-sm text-kindly-muted">
              One eligible wish, weighted fairly. Skip and try again in this session.
            </p>
          </div>
          <button
            type="button"
            disabled={surpriseBusy}
            onClick={handleSurprise}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-kindly-accent px-5 py-3 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
          >
            {surpriseBusy ? "Choosing…" : "Surprise me"}
          </button>
        </div>
        {surpriseNeedsAuth && (
          <p className="mt-2 text-sm">
            <Link href="/sign-in" className="font-semibold text-kindly-accent underline">
              Sign in to use Surprise Me
            </Link>
          </p>
        )}
        {surpriseError && (
          <p role="alert" className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {surpriseError}
          </p>
        )}
      </div>

      <FeedResults
        key={`${sort}|${city}|${reloadKey}`}
        sort={sort}
        city={city}
        onRetry={() => setReloadKey((current) => current + 1)}
      />
    </section>
  );
}
