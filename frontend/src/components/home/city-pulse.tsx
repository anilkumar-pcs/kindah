"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { ApiError } from "@/lib/api/client";
import { getPublicStats, type PublicStats } from "@/lib/api/discovery";

const number = new Intl.NumberFormat("en-IN");

function weekday(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "short",
    timeZone: "Asia/Kolkata",
  });
}

function shortDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
}

function StatTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-kindly-border bg-kindly-card p-3.5">
      <p className="text-[10px] font-extrabold tracking-[0.14em] text-kindly-muted uppercase">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-semibold tracking-[-0.045em] text-kindly-ink">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] leading-4 text-kindly-muted">{detail}</p>
    </div>
  );
}

function WeeklyChart({ stats }: { stats: PublicStats }) {
  const series = stats.weeklyConfirmedGifts;
  const max = Math.max(...series.map((day) => day.count), 0);
  const weekTotal = series.reduce((total, day) => total + day.count, 0);
  const weekValue = series.reduce((total, day) => total + day.valueInr, 0);
  const peak = series.reduce(
    (best, day) => (day.count > best.count ? day : best),
    series[0] ?? { date: "", count: 0, valueInr: 0 },
  );

  return (
    <figure
      aria-labelledby="city-pulse-chart-heading"
      className="rounded-2xl border border-kindly-border bg-kindly-card p-4"
    >
      <figcaption>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3
              id="city-pulse-chart-heading"
              className="font-display text-lg font-semibold tracking-[-0.035em]"
            >
              This week&rsquo;s little loop
            </h3>
            <p className="mt-0.5 text-xs leading-5 text-kindly-muted">
              Recipient-confirmed gifts, day by day. Attested, not bank-verified.
            </p>
          </div>
          <span className="rounded-full bg-kindly-accent-soft px-2.5 py-1 text-[10px] font-extrabold text-kindly-accent">
            {weekTotal} confirmed · ₹{number.format(weekValue)}
          </span>
        </div>
      </figcaption>

      <div
        role="img"
        aria-label={`${weekTotal} recipient-confirmed gifts this week. ${
          peak.count > 0
            ? `Highest day: ${weekday(peak.date)} with ${peak.count}.`
            : "No confirmed gifts yet."
        }`}
        className="mt-4"
      >
        <div className="flex items-end gap-1 border-b border-kindly-border/80 pb-1">
          {series.map((day) => {
            const height = max > 0 && day.count > 0 ? Math.max((day.count / max) * 100, 10) : 0;
            return (
              <div
                key={day.date}
                title={`${weekday(day.date)} ${shortDate(day.date)}: ${day.count} confirmed gift${
                  day.count === 1 ? "" : "s"
                } · ₹${number.format(day.valueInr)}`}
                className="flex h-24 flex-1 items-end"
              >
                <span
                  aria-hidden="true"
                  className="mx-auto block w-full max-w-6 rounded-t-[4px] bg-kindly-accent"
                  style={{ height: `${height}%` }}
                />
              </div>
            );
          })}
        </div>
        <ol aria-hidden="true" className="mt-1.5 grid grid-cols-7 gap-1">
          {series.map((day) => (
            <li key={day.date} className="text-center text-[9px] font-bold text-kindly-muted">
              {weekday(day.date)}
            </li>
          ))}
        </ol>
      </div>

      <details className="mt-3 text-xs">
        <summary className="cursor-pointer font-semibold text-kindly-muted underline underline-offset-4">
          View daily numbers
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="border-b border-kindly-border text-kindly-muted">
                <th scope="col" className="py-1.5 pr-2 font-semibold">
                  Day
                </th>
                <th scope="col" className="py-1.5 pr-2 font-semibold">
                  Confirmed
                </th>
                <th scope="col" className="py-1.5 font-semibold">
                  Attested value
                </th>
              </tr>
            </thead>
            <tbody>
              {series.map((day) => (
                <tr key={day.date} className="border-b border-kindly-border/50 last:border-0">
                  <th scope="row" className="py-1.5 pr-2 font-medium text-kindly-ink">
                    {weekday(day.date)} {shortDate(day.date)}
                  </th>
                  <td className="py-1.5 pr-2">{day.count}</td>
                  <td className="py-1.5">₹{number.format(day.valueInr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

function AreaPulse({ stats }: { stats: PublicStats }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-kindly-border bg-kindly-sky/40 p-4">
      <svg
        aria-hidden="true"
        viewBox="0 0 360 180"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-30"
      >
        <path
          d="M-20 130c50-30 70-78 128-72 42 4 42 42 94 38 54-4 74-46 172-28"
          fill="none"
          stroke="#1f6b51"
          strokeWidth="2"
        />
        <path
          d="M20 20c58 24 65 56 118 61 39 4 60-30 108-21 33 6 52 28 96 30"
          fill="none"
          stroke="#1f6b51"
          strokeWidth="1.5"
        />
        <circle cx="98" cy="97" r="4" fill="#e86a4a" />
        <circle cx="211" cy="83" r="3" fill="#1f6b51" />
        <circle cx="276" cy="47" r="5" fill="#f2b544" />
      </svg>
      <div className="relative">
        <p className="text-[10px] font-extrabold tracking-[0.14em] text-kindly-accent uppercase">
          Neighbourhood pulse
        </p>
        <h3 className="mt-1 font-display text-lg font-semibold tracking-[-0.035em]">
          Where little gifts landed
        </h3>
        <p className="mt-0.5 max-w-sm text-xs leading-5 text-kindly-muted">
          Grouped from recipient wish cities. No donor location, precise address or individual money
          flow is shown.
        </p>
        {stats.activeNeighbourhoods.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {stats.activeNeighbourhoods.map((area) => (
              <li
                key={area.label}
                className="rounded-full border border-kindly-accent/20 bg-kindly-card/85 px-2.5 py-1 text-xs font-bold capitalize text-kindly-ink"
              >
                {area.label}
                <span className="ml-1 text-kindly-muted">· {area.confirmedGiftCount}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-xl border border-kindly-border bg-kindly-card/70 p-2.5 text-xs text-kindly-muted">
            Not enough confirmed activity in an area to show it safely yet. Small slices stay
            hidden.
          </p>
        )}
      </div>
    </div>
  );
}

export function CityPulse() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getPublicStats()
      .then((value) => {
        if (!cancelled) {
          setStats(value);
          setState("ready");
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof ApiError ? loadError.message : "Could not load the city pulse.",
          );
          setState("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return (
    <section
      aria-labelledby="city-pulse-heading"
      className="relative overflow-hidden rounded-[2rem] border border-kindly-border bg-kindly-cream/70 p-4 sm:p-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full bg-kindly-marigold/20 blur-3xl"
      />
      <div className="relative flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="kindly-eyebrow">City pulse</p>
          <h2
            id="city-pulse-heading"
            className="mt-1 font-display text-3xl font-semibold tracking-[-0.05em] sm:text-4xl"
          >
            Kindness, in the aggregate
          </h2>
          <p className="mt-1.5 max-w-xl text-sm leading-6 text-kindly-muted">
            A warm look at what the community has confirmed. No individual giver, recipient or
            payment route is exposed.
          </p>
        </div>
        <span className="kindly-chip">
          <Icon name="shield" className="h-3 w-3" /> Attested activity
        </span>
      </div>

      {state === "loading" && (
        <div aria-live="polite" className="relative mt-5 grid gap-2 sm:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <span
              key={item}
              className="h-24 animate-pulse rounded-2xl bg-kindly-accent-soft/70"
              aria-hidden="true"
            />
          ))}
          <span className="sr-only">Loading the city pulse</span>
        </div>
      )}

      {state === "error" && (
        <div role="alert" className="relative mt-5 rounded-2xl bg-kindly-card p-4 text-sm">
          <p className="font-bold">The city pulse is taking a little pause.</p>
          <p className="mt-1 text-kindly-muted">{error}</p>
          <button
            type="button"
            onClick={() => {
              setState("loading");
              setError(null);
              setReloadKey((current) => current + 1);
            }}
            className="kindly-btn-secondary mt-3 !min-h-9"
          >
            Try again
          </button>
        </div>
      )}

      {state === "ready" && stats && (
        <div className="relative mt-5 space-y-3">
          <div className="grid gap-2 sm:grid-cols-4">
            <StatTile
              label="Kind neighbours"
              value={number.format(stats.memberCount)}
              detail="active pseudonymous members"
            />
            <StatTile
              label="Wishes waiting"
              value={number.format(stats.openWishCount)}
              detail="open right now"
            />
            <StatTile
              label="Kindness confirmed"
              value={`₹${number.format(stats.confirmedGiftValueInrAllTime)}`}
              detail={`${number.format(stats.confirmedGiftCountAllTime)} attested ${
                stats.confirmedGiftCountAllTime === 1 ? "gift" : "gifts"
              } so far`}
            />
            <StatTile
              label="Kindness streak"
              value={
                stats.communityStreakDays > 0
                  ? `${stats.communityStreakDays} ${
                      stats.communityStreakDays === 1 ? "day" : "days"
                    }`
                  : "—"
              }
              detail="consecutive days with a confirmed gift"
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
            <WeeklyChart stats={stats} />
            <AreaPulse stats={stats} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-kindly-muted">
            <p>
              {number.format(stats.wishesSharedCount)} wishes shared ·{" "}
              {number.format(stats.confirmedGiftCountThisWeek)} confirmed this week
            </p>
            <p>
              Updated{" "}
              {new Date(stats.generatedAt).toLocaleTimeString("en-IN", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
