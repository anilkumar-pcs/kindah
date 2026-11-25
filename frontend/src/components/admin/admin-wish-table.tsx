"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { ModerationActionForm } from "@/components/admin/moderation-action-form";
import { Icon } from "@/components/ui/icon";
import { listAdminWishes, type AdminWish, type AdminWishPage } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import type { WishMood, WishStatus } from "@/lib/api/wishes";

type Props = {
  mfaToken: string;
  onChanged: () => Promise<void>;
};

const WISH_STATUSES: WishStatus[] = [
  "OPEN",
  "LOCKED",
  "PAYMENT_CLAIMED",
  "GRANTED",
  "UNVERIFIED",
  "DISPUTED",
  "EXPIRED",
  "UNDER_REVIEW",
  "REMOVED",
];

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
    year: "numeric",
  });
}

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Could not load wishes.";
}

function statusLabel(status: string): string {
  return status.replaceAll("_", " ").toLowerCase();
}

export function AdminWishTable({ mfaToken, onChanged }: Props) {
  const [data, setData] = useState<AdminWishPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queryDraft, setQueryDraft] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState<AdminWish | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    listAdminWishes(mfaToken, {
      query,
      status: status || undefined,
      page,
      pageSize: 10,
    })
      .then((value) => {
        if (!cancelled) {
          setError(null);
          setData(value);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(errorMessage(loadError));
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
  }, [mfaToken, query, status, page, reloadKey]);

  useEffect(() => {
    if (!selected) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelected(null);
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [selected]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setPage(1);
    setQuery(queryDraft.trim());
    setReloadKey((current) => current + 1);
  }

  const totalPages = data ? Math.max(Math.ceil(data.total / data.pageSize), 1) : 1;

  return (
    <section aria-labelledby="admin-wishes-heading" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2
            id="admin-wishes-heading"
            className="font-display text-2xl font-semibold tracking-[-0.04em]"
          >
            Wishes
          </h2>
          <p className="mt-1 text-sm text-kindly-muted">
            Search and filter every wish, then open a row to hide, restore or remove it with an
            audited reason.
          </p>
        </div>
        <span className="text-xs font-semibold text-kindly-muted">
          {data ? `${data.total} total` : "Loading…"}
        </span>
      </div>

      <form
        onSubmit={submitSearch}
        role="search"
        aria-label="Search wishes"
        className="flex flex-wrap items-end gap-2 rounded-2xl border border-kindly-border bg-kindly-card p-3"
      >
        <div className="min-w-48 flex-1">
          <label htmlFor="admin-wish-search" className="kindly-label">
            Search wish or pseudonym
          </label>
          <input
            id="admin-wish-search"
            type="search"
            maxLength={80}
            value={queryDraft}
            onChange={(event) => setQueryDraft(event.target.value)}
            className="kindly-input mt-1"
          />
        </div>
        <div>
          <label htmlFor="admin-wish-status" className="kindly-label">
            Wish status
          </label>
          <select
            id="admin-wish-status"
            value={status}
            onChange={(event) => {
              setLoading(true);
              setStatus(event.target.value);
              setPage(1);
            }}
            className="kindly-input mt-1 !min-h-10"
          >
            <option value="">All statuses</option>
            {WISH_STATUSES.map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="kindly-btn-secondary">
          Search
        </button>
      </form>

      {error && (
        <p role="alert" className="kindly-status-error">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-kindly-border bg-kindly-card">
        <table className="hidden w-full min-w-[760px] text-left text-sm md:table">
          <caption className="sr-only">Wishes and moderation status</caption>
          <thead className="border-b border-kindly-border bg-kindly-cream/70 text-[10px] tracking-[0.12em] text-kindly-muted uppercase">
            <tr>
              <th scope="col" className="px-3 py-2.5 font-extrabold">
                Wish
              </th>
              <th scope="col" className="px-3 py-2.5 font-extrabold">
                Pseudonym
              </th>
              <th scope="col" className="px-3 py-2.5 font-extrabold">
                Status
              </th>
              <th scope="col" className="px-3 py-2.5 font-extrabold">
                Created
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-extrabold">
                Action
              </th>
            </tr>
          </thead>
          <tbody aria-busy={loading}>
            {data?.wishes.map((wish) => (
              <tr key={wish.id} className="border-b border-kindly-border/60 last:border-0">
                <td className="max-w-[280px] px-3 py-2.5">
                  <p className="truncate font-semibold">{wish.message}</p>
                  <p className="text-[10px] text-kindly-muted">{wish.id.slice(0, 8)}</p>
                </td>
                <td className="px-3 py-2.5 text-xs">{wish.displayName ?? "—"}</td>
                <td className="px-3 py-2.5">
                  <span className="rounded-full bg-kindly-accent-soft px-2 py-0.5 text-[10px] font-extrabold text-kindly-accent capitalize">
                    {statusLabel(wish.status)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-xs text-kindly-muted">
                  {formatDate(wish.createdAt)}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button
                    type="button"
                    aria-label={`Manage wish ${wish.id.slice(0, 8)}`}
                    onClick={() => setSelected(wish)}
                    className="kindly-btn-quiet !min-h-8 !px-2 !text-xs"
                  >
                    Manage
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="divide-y divide-kindly-border/60 md:hidden" aria-busy={loading}>
          {data?.wishes.map((wish) => (
            <li key={wish.id} className="space-y-2 p-3">
              <p className="font-semibold">{wish.message}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-kindly-muted">
                <span>{wish.displayName ?? "—"}</span>
                <span>·</span>
                <span className="capitalize">{statusLabel(wish.status)}</span>
                <span>·</span>
                <span>{formatDate(wish.createdAt)}</span>
              </div>
              <button
                type="button"
                aria-label={`Manage wish ${wish.id.slice(0, 8)}`}
                onClick={() => setSelected(wish)}
                className="kindly-btn-secondary !min-h-9 w-full !text-xs"
              >
                Manage
              </button>
            </li>
          ))}
        </ul>
      </div>

      {!loading && data?.wishes.length === 0 && (
        <p className="rounded-2xl border border-kindly-border bg-kindly-card p-6 text-center text-sm text-kindly-muted">
          No matching wishes.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-kindly-muted">
        <p>
          Page {data?.page ?? 1} of {totalPages} · {data?.pageSize ?? 10} per page
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setPage((current) => Math.max(current - 1, 1));
            }}
            disabled={!data || data.page <= 1 || loading}
            className="kindly-btn-secondary !min-h-9 !px-3 !text-xs"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setPage((current) => Math.min(current + 1, totalPages));
            }}
            disabled={!data || data.page >= totalPages || loading}
            className="kindly-btn-secondary !min-h-9 !px-3 !text-xs"
          >
            Next
          </button>
        </div>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-wish-detail-title"
        >
          <button
            type="button"
            aria-label="Dismiss wish details"
            className="absolute inset-0 bg-kindly-ink/35 backdrop-blur-[2px]"
            onClick={() => setSelected(null)}
          />
          <section className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto bg-kindly-card p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="kindly-eyebrow">Wish detail</p>
                <h3
                  id="admin-wish-detail-title"
                  className="mt-1 font-display text-2xl font-semibold tracking-[-0.04em]"
                >
                  {selected.displayName ?? "Unknown pseudonym"}
                </h3>
                <p className="mt-1 text-xs text-kindly-muted">
                  {selected.id} · {statusLabel(selected.status)}
                </p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setSelected(null)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-kindly-border"
              >
                <span className="sr-only">Close wish details</span>
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 rounded-2xl bg-kindly-accent-soft/50 p-4">
              <p className="text-base leading-6">{selected.message}</p>
              <p className="mt-2 text-xs text-kindly-muted">
                {MOOD_LABELS[selected.mood]}
                {selected.suggestedAmountInr
                  ? ` · suggested ₹${selected.suggestedAmountInr}`
                  : " · donor chooses amount"}
                {selected.city ? ` · ${selected.city}` : ""}
              </p>
              <p className="mt-1 text-xs text-kindly-muted">
                Created {formatDate(selected.createdAt)} · expires {formatDate(selected.expiresAt)}
                {selected.closedReason ? ` · ${selected.closedReason.toLowerCase()}` : ""}
              </p>
            </div>

            <div className="mt-4 rounded-2xl border border-kindly-border p-3">
              <ModerationActionForm
                mfaToken={mfaToken}
                targetType="WISH"
                targetId={selected.id}
                onApplied={async () => {
                  setLoading(true);
                  setReloadKey((current) => current + 1);
                  await onChanged();
                }}
              />
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
