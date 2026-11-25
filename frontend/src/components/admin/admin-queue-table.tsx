"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";

import { Icon } from "@/components/ui/icon";

export type QueueColumn<T> = {
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
};

export type QueueFilter = {
  label: string;
  options: Array<{ value: string; label: string }>;
};

export type QueueSourceParams = {
  query: string;
  filter: string;
  page: number;
  pageSize: number;
};

export type QueuePage<T> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
};

type Props<T extends { id: string }> = {
  title: string;
  description: string;
  source: (params: QueueSourceParams) => Promise<QueuePage<T>>;
  columns: Array<QueueColumn<T>>;
  getKey: (row: T) => string;
  detailTitle: (row: T) => string;
  renderDetail: (row: T) => ReactNode;
  filter?: QueueFilter;
  emptyMessage: string;
  note?: ReactNode;
  pageSize?: number;
  refreshKey?: number;
};

function formatCount(value: number, noun: string): string {
  return `${value} ${noun}${value === 1 ? "" : "s"}`;
}

export function AdminQueueTable<T extends { id: string }>({
  title,
  description,
  source,
  columns,
  getKey,
  detailTitle,
  renderDetail,
  filter,
  emptyMessage,
  note,
  pageSize = 10,
  refreshKey = 0,
}: Props<T>) {
  const [data, setData] = useState<QueuePage<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [query, setQuery] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<T | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const slug = title.toLowerCase().replaceAll(" ", "-");

  useEffect(() => {
    let cancelled = false;
    source({ query, filter: filterValue, page, pageSize })
      .then((result) => {
        if (!cancelled) {
          setError(null);
          setData(result);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load this queue.");
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
  }, [source, query, filterValue, page, pageSize, refreshKey]);

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
    setQuery(searchDraft.trim());
  }

  const totalPages = data ? Math.max(Math.ceil(data.total / data.pageSize), 1) : 1;
  const currentPage = data?.page ?? 1;
  const rows = data?.rows ?? [];

  return (
    <section aria-labelledby={`admin-${slug}-heading`} className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2
            id={`admin-${slug}-heading`}
            className="font-display text-2xl font-semibold tracking-[-0.04em]"
          >
            {title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-kindly-muted">{description}</p>
        </div>
        <span className="text-xs font-semibold text-kindly-muted">
          {formatCount(data?.total ?? 0, "row")}
        </span>
      </div>

      <form
        onSubmit={submitSearch}
        role="search"
        aria-label={`Search ${title.toLowerCase()}`}
        className="flex flex-wrap items-end gap-2 rounded-2xl border border-kindly-border bg-kindly-card p-3"
      >
        <div className="min-w-48 flex-1">
          <label htmlFor={`admin-${slug}-search`} className="kindly-label">
            Search
          </label>
          <input
            id={`admin-${slug}-search`}
            type="search"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            className="kindly-input mt-1"
            placeholder={`Search ${title.toLowerCase()}`}
          />
        </div>
        {filter && (
          <div>
            <label htmlFor={`admin-${slug}-filter`} className="kindly-label">
              {filter.label}
            </label>
            <select
              id={`admin-${slug}-filter`}
              value={filterValue}
              onChange={(event) => {
                setLoading(true);
                setFilterValue(event.target.value);
                setPage(1);
              }}
              className="kindly-input mt-1 !min-h-10"
            >
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <button type="submit" disabled={loading} className="kindly-btn-secondary">
          Search
        </button>
      </form>

      {note}

      {error && (
        <p role="alert" className="kindly-status-error">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-kindly-border bg-kindly-card">
        <table className="hidden w-full min-w-[720px] text-left text-sm md:table">
          <caption className="sr-only">{title}</caption>
          <thead className="border-b border-kindly-border bg-kindly-cream/70 text-[10px] tracking-[0.12em] text-kindly-muted uppercase">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.header}
                  scope="col"
                  className={`px-3 py-2.5 font-extrabold ${column.className ?? ""}`}
                >
                  {column.header}
                </th>
              ))}
              <th scope="col" className="px-3 py-2.5 text-right font-extrabold">
                Action
              </th>
            </tr>
          </thead>
          <tbody aria-busy={loading}>
            {rows.map((row) => (
              <tr key={getKey(row)} className="border-b border-kindly-border/60 last:border-0">
                {columns.map((column) => (
                  <td key={column.header} className={`px-3 py-2.5 ${column.className ?? ""}`}>
                    {column.render(row)}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => setSelected(row)}
                    aria-label={`Open ${detailTitle(row)}`}
                    className="kindly-btn-quiet !min-h-8 !px-2 !text-xs"
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <ul className="divide-y divide-kindly-border/60 md:hidden" aria-busy={loading}>
          {rows.map((row) => (
            <li key={getKey(row)} className="space-y-2 p-3">
              <div className="space-y-1">
                {columns.map((column) => (
                  <div
                    key={column.header}
                    className="flex items-start justify-between gap-3 text-sm"
                  >
                    <span className="shrink-0 text-[10px] font-extrabold tracking-[0.1em] text-kindly-muted uppercase">
                      {column.header}
                    </span>
                    <span className="min-w-0 text-right">{column.render(row)}</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setSelected(row)}
                aria-label={`Open ${detailTitle(row)}`}
                className="kindly-btn-secondary !min-h-9 w-full !text-xs"
              >
                Open
              </button>
            </li>
          ))}
        </ul>
      </div>

      {!loading && rows.length === 0 && (
        <p className="rounded-2xl border border-kindly-border bg-kindly-card p-6 text-center text-sm text-kindly-muted">
          {emptyMessage}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-kindly-muted">
        <p>
          Page {currentPage} of {totalPages} · {data?.pageSize ?? pageSize} per page
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setPage((current) => Math.max(current - 1, 1));
            }}
            disabled={!data || currentPage <= 1 || loading}
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
            disabled={!data || currentPage >= totalPages || loading}
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
          aria-labelledby="admin-queue-detail-title"
        >
          <button
            type="button"
            aria-label={`Dismiss ${title} details`}
            className="absolute inset-0 bg-kindly-ink/35 backdrop-blur-[2px]"
            onClick={() => setSelected(null)}
          />
          <section className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto bg-kindly-card p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="kindly-eyebrow">{title} detail</p>
                <h3
                  id="admin-queue-detail-title"
                  className="mt-1 font-display text-2xl font-semibold tracking-[-0.04em]"
                >
                  {detailTitle(selected)}
                </h3>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setSelected(null)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-kindly-border"
              >
                <span className="sr-only">Close details</span>
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4">{renderDetail(selected)}</div>
          </section>
        </div>
      )}
    </section>
  );
}
