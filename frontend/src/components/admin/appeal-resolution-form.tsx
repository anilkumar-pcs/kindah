"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import { resolveAppeal } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";

type AppealResolutionFormProps = {
  mfaToken: string;
  appealId: string;
  onResolved: () => Promise<void>;
};

export function AppealResolutionForm({
  mfaToken,
  appealId,
  onResolved,
}: AppealResolutionFormProps) {
  const [outcome, setOutcome] = useState<"ACCEPTED" | "REJECTED">("ACCEPTED");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (note.trim().length < 5) {
      setError("A resolution note of at least 5 characters is required.");
      return;
    }
    setBusy(true);
    try {
      await resolveAppeal(mfaToken, appealId, {
        outcome,
        resolutionNote: note.trim(),
      });
      setMessage(`Appeal ${outcome.toLowerCase()} with an audit entry.`);
      setNote("");
      await onResolved();
    } catch (resolveError) {
      setError(
        resolveError instanceof ApiError ? resolveError.message : "Could not resolve the appeal.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2 rounded-xl bg-stone-50 p-3 text-sm">
      <div className="flex flex-wrap gap-2">
        <div>
          <label htmlFor={`appeal-outcome-${appealId}`} className="block text-xs font-medium">
            Outcome
          </label>
          <select
            id={`appeal-outcome-${appealId}`}
            value={outcome}
            onChange={(event) => setOutcome(event.target.value as "ACCEPTED" | "REJECTED")}
            className="mt-1 min-h-11 rounded-xl border border-kindly-border bg-white px-3 py-2 text-sm"
          >
            <option value="ACCEPTED">ACCEPTED</option>
            <option value="REJECTED">REJECTED</option>
          </select>
        </div>
        <div className="min-w-48 flex-1">
          <label htmlFor={`appeal-resolution-${appealId}`} className="block text-xs font-medium">
            Resolution note (mandatory)
          </label>
          <input
            id={`appeal-resolution-${appealId}`}
            type="text"
            required
            minLength={5}
            maxLength={1000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-xl border border-kindly-border bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-2 text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p aria-live="polite" className="rounded-xl bg-green-50 p-2 text-green-900">
          {message}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-kindly-accent px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
      >
        {busy ? "Resolving…" : "Resolve appeal"}
      </button>
    </form>
  );
}
