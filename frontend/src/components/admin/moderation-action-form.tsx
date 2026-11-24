"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import { moderateUser, moderateWish } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";

const WISH_ACTIONS = ["HIDE", "RESTORE", "REMOVE"] as const;
const USER_ACTIONS = ["WARN", "RESTRICT", "SUSPEND", "BAN", "REACTIVATE"] as const;

type WishAction = (typeof WISH_ACTIONS)[number];
type UserAction = (typeof USER_ACTIONS)[number];

type ModerationActionFormProps = {
  mfaToken: string;
  targetType: "WISH" | "USER";
  targetId: string;
  onApplied: () => Promise<void>;
};

export function ModerationActionForm({
  mfaToken,
  targetType,
  targetId,
  onApplied,
}: ModerationActionFormProps) {
  const actions = targetType === "WISH" ? WISH_ACTIONS : USER_ACTIONS;
  const [action, setAction] = useState<string>(actions[0]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (reason.trim().length < 5) {
      setError("A reason of at least 5 characters is required.");
      return;
    }
    setBusy(true);
    try {
      if (targetType === "WISH") {
        await moderateWish(mfaToken, targetId, {
          action: action as WishAction,
          reason: reason.trim(),
        });
      } else {
        await moderateUser(mfaToken, targetId, {
          action: action as UserAction,
          reason: reason.trim(),
        });
      }
      setMessage(`${action} recorded with an audit entry.`);
      setReason("");
      await onApplied();
    } catch (actionError) {
      setError(
        actionError instanceof ApiError
          ? actionError.message
          : "Could not apply the moderation action.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2 rounded-xl bg-stone-50 p-3 text-sm">
      <p className="font-semibold">Moderation action</p>
      <div className="flex flex-wrap gap-2">
        <div>
          <label htmlFor={`moderation-action-${targetId}`} className="block text-xs font-medium">
            Action
          </label>
          <select
            id={`moderation-action-${targetId}`}
            value={action}
            onChange={(event) => setAction(event.target.value)}
            className="kindly-input mt-1"
          >
            {actions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-48 flex-1">
          <label htmlFor={`moderation-reason-${targetId}`} className="block text-xs font-medium">
            Reason (mandatory)
          </label>
          <input
            id={`moderation-reason-${targetId}`}
            type="text"
            required
            minLength={5}
            maxLength={1000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="kindly-input mt-1"
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
      <button type="submit" disabled={busy} className="kindly-btn-primary">
        {busy ? "Applying…" : "Apply action"}
      </button>
    </form>
  );
}
