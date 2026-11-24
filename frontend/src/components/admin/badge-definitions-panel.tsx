"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import {
  createAdminBadge,
  deactivateAdminBadge,
  updateAdminBadge,
  type BadgeDefinition,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";

type Draft = {
  label: string;
  ruleType: BadgeDefinition["ruleType"];
  threshold: string;
  sortOrder: string;
};

type Props = {
  mfaToken: string;
  definitions: BadgeDefinition[];
  onChanged: () => Promise<void>;
};

function draftFor(definition: BadgeDefinition): Draft {
  return {
    label: definition.label,
    ruleType: definition.ruleType,
    threshold: String(definition.threshold),
    sortOrder: String(definition.sortOrder),
  };
}

export function BadgeDefinitionsPanel({ mfaToken, definitions, onChanged }: Props) {
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [ruleType, setRuleType] = useState<BadgeDefinition["ruleType"]>("CONFIRMED_SENT");
  const [threshold, setThreshold] = useState("1");
  const [sortOrder, setSortOrder] = useState("100");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(success);
      await onChanged();
    } catch (actionError) {
      setError(
        actionError instanceof ApiError
          ? actionError.message
          : "Could not update badge definitions.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedThreshold = Number(threshold);
    const parsedSort = Number(sortOrder);
    if (!Number.isInteger(parsedThreshold) || parsedThreshold < 1) {
      setError("Threshold must be a positive whole number.");
      return;
    }
    await run(
      () =>
        createAdminBadge(mfaToken, {
          code: code.trim().toUpperCase(),
          label: label.trim(),
          ruleType,
          threshold: parsedThreshold,
          sortOrder: Number.isInteger(parsedSort) ? parsedSort : 0,
        }),
      "Badge definition created.",
    );
    setCode("");
    setLabel("");
  }

  async function handleSave(definition: BadgeDefinition) {
    const draft = drafts[definition.code] ?? draftFor(definition);
    const parsedThreshold = Number(draft.threshold);
    if (!Number.isInteger(parsedThreshold) || parsedThreshold < 1) {
      setError("Threshold must be a positive whole number.");
      return;
    }
    await run(
      () =>
        updateAdminBadge(mfaToken, definition.code, {
          label: draft.label.trim(),
          ruleType: draft.ruleType,
          threshold: parsedThreshold,
          sortOrder: Number(draft.sortOrder) || 0,
        }),
      "Badge definition updated.",
    );
  }

  async function handleToggleActive(definition: BadgeDefinition) {
    if (definition.active) {
      await run(
        () => deactivateAdminBadge(mfaToken, definition.code),
        "Badge deactivated; earned badges are retained.",
      );
    } else {
      await run(
        () => updateAdminBadge(mfaToken, definition.code, { active: true }),
        "Badge reactivated.",
      );
    }
  }

  return (
    <section aria-labelledby="badge-definitions-heading" className="space-y-3">
      <h2 id="badge-definitions-heading" className="text-xl font-semibold">
        Badge definitions
      </h2>
      <p className="rounded-2xl border border-kindly-border bg-white p-4 text-sm text-kindly-muted">
        This is the single configurable registry. Deactivating a badge stops future awards but keeps
        badges already earned. Rule types are code-backed; labels, thresholds, order and active
        state are database-editable.
      </p>

      <form
        onSubmit={handleCreate}
        className="rounded-2xl border border-kindly-border bg-white p-5 text-sm"
      >
        <h3 className="font-semibold">Add a badge</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-5">
          <div>
            <label htmlFor="badge-code" className="block text-xs font-medium">
              Code
            </label>
            <input
              id="badge-code"
              required
              minLength={3}
              maxLength={32}
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              className="mt-1 min-h-11 w-full rounded-xl border border-kindly-border px-3 py-2 text-sm"
              placeholder="HELPER_10"
            />
          </div>
          <div>
            <label htmlFor="badge-label" className="block text-xs font-medium">
              Label
            </label>
            <input
              id="badge-label"
              required
              minLength={2}
              maxLength={64}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-kindly-border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="badge-rule" className="block text-xs font-medium">
              Rule
            </label>
            <select
              id="badge-rule"
              value={ruleType}
              onChange={(event) => setRuleType(event.target.value as BadgeDefinition["ruleType"])}
              className="mt-1 min-h-11 w-full rounded-xl border border-kindly-border bg-white px-3 py-2 text-sm"
            >
              <option value="CONFIRMED_SENT">Confirmed gifts sent</option>
              <option value="THANKS_RECEIVED">Thanks received</option>
              <option value="STREAK_DAYS">IST giving streak days</option>
            </select>
          </div>
          <div>
            <label htmlFor="badge-threshold" className="block text-xs font-medium">
              Threshold
            </label>
            <input
              id="badge-threshold"
              type="number"
              min={1}
              value={threshold}
              onChange={(event) => setThreshold(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-kindly-border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="badge-sort" className="block text-xs font-medium">
              Sort order
            </label>
            <input
              id="badge-sort"
              type="number"
              min={0}
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-kindly-border px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-kindly-accent px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Add badge"}
        </button>
      </form>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p aria-live="polite" className="rounded-xl bg-green-50 p-3 text-sm text-green-900">
          {message}
        </p>
      )}

      {definitions.map((definition) => {
        const draft = drafts[definition.code] ?? draftFor(definition);
        const updateDraft = (patch: Partial<Draft>) =>
          setDrafts((current) => ({
            ...current,
            [definition.code]: { ...draft, ...patch },
          }));
        return (
          <article
            key={definition.code}
            className="rounded-2xl border border-kindly-border bg-white p-5 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">
                {definition.label} <span className="font-mono text-xs">{definition.code}</span>
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  definition.active ? "bg-green-50 text-green-800" : "bg-stone-100 text-stone-700"
                }`}
              >
                {definition.active ? "ACTIVE" : "INACTIVE"}
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              <div>
                <label
                  htmlFor={`badge-label-${definition.code}`}
                  className="block text-xs font-medium"
                >
                  Label
                </label>
                <input
                  id={`badge-label-${definition.code}`}
                  value={draft.label}
                  onChange={(event) => updateDraft({ label: event.target.value })}
                  className="mt-1 min-h-11 w-full rounded-xl border border-kindly-border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor={`badge-rule-${definition.code}`}
                  className="block text-xs font-medium"
                >
                  Rule
                </label>
                <select
                  id={`badge-rule-${definition.code}`}
                  value={draft.ruleType}
                  onChange={(event) =>
                    updateDraft({
                      ruleType: event.target.value as BadgeDefinition["ruleType"],
                    })
                  }
                  className="mt-1 min-h-11 w-full rounded-xl border border-kindly-border bg-white px-3 py-2 text-sm"
                >
                  <option value="CONFIRMED_SENT">Confirmed gifts sent</option>
                  <option value="THANKS_RECEIVED">Thanks received</option>
                  <option value="STREAK_DAYS">IST giving streak days</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor={`badge-threshold-${definition.code}`}
                  className="block text-xs font-medium"
                >
                  Threshold
                </label>
                <input
                  id={`badge-threshold-${definition.code}`}
                  type="number"
                  min={1}
                  value={draft.threshold}
                  onChange={(event) => updateDraft({ threshold: event.target.value })}
                  className="mt-1 min-h-11 w-full rounded-xl border border-kindly-border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor={`badge-sort-${definition.code}`}
                  className="block text-xs font-medium"
                >
                  Sort order
                </label>
                <input
                  id={`badge-sort-${definition.code}`}
                  type="number"
                  min={0}
                  value={draft.sortOrder}
                  onChange={(event) => updateDraft({ sortOrder: event.target.value })}
                  className="mt-1 min-h-11 w-full rounded-xl border border-kindly-border px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => handleSave(definition)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-kindly-accent px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
              >
                Save changes
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleToggleActive(definition)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-kindly-border px-4 py-2 text-sm font-semibold hover:bg-kindly-accent-soft disabled:opacity-60"
              >
                {definition.active ? "Deactivate" : "Reactivate"}
              </button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
