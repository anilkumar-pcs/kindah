"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Icon } from "@/components/ui/icon";

export type QueueColumn<T> = {
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
};

export type QueueFilter<T> = {
  label: string;
  options: Array<{ value: string; label: string }>;
  predicate: (row: T, value: string) => boolean;
};

type Props<T extends { id: string }> = {
  title: string;
  description: string;
  rows: T[];
  columns: Array<QueueColumn<T>>;
  searchText: (row: T) => string;
  getKey: (row: T) => string;
  detailTitle: (row: T) => string;
  renderDetail: (row: T) => ReactNode;
  filter?: QueueFilter<T>;
  emptyMessage: string;
  note?: ReactNode;
  pageSize?: number;
};

function formatCount(value: number, noun: string): string {
  return `${value} ${noun}${value === 1 ? "" : "s"}`;
}

export function AdminQueueTable<T extends { id: string }>({
  title,
  description,
  rows,
  columns,
  searchText,
  getKey,
  detailTitle,
  renderDetail,
  filter,
  emptyMessage,
  note,
  pageSize = 10,
}: Props<T>) {
  const [search, setSearch] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<T | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const slug = title.toLowerCase().replaceAll(" ", "-");

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

  const term = search.trim().toLowerCase();
  const filtered = rows
    .filter((row) => !term || searchText(row).toLowerCase().includes(term))
    .filter((row) => !filter || !filterValue || filter.predicate(row, filterValue));
  const totalPages = Math.max(Math.ceil(filtered.length / pageSize), 1);
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

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
          {formatCount(filtered.length, "row")}
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-kindly-border bg-kindly-card p-3">
        <div className="min-w-48 flex-1">
          <label htmlFor={`admin-${slug}-search`} className="kindly-label">
            Search
          </label>
          <input
            id={`admin-${slug}-search`}
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
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
      </div>

      {note}

      <div className="overflow-x-auto rounded-2xl border border-kindly-border bg-kindly-card">
        <table className="w-full min-w-[720px] text-left text-sm">
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
          <tbody>
            {visible.map((row) => (
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
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-3 py-8 text-center text-sm text-kindly-muted"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-kindly-muted">
        <p>
          Page {safePage} of {totalPages} · {pageSize} per page
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(current - 1, 1))}
            disabled={safePage <= 1}
            className="kindly-btn-secondary !min-h-9 !px-3 !text-xs"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
            disabled={safePage >= totalPages}
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
