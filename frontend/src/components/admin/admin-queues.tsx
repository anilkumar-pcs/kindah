"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import { AdminQueueTable } from "@/components/admin/admin-queue-table";
import { AppealResolutionForm } from "@/components/admin/appeal-resolution-form";
import {
  resolveSupportCase,
  type AdminAppeal,
  type AdminAuditLog,
  type AdminDeletionRequest,
  type AdminSupportCase,
  type OutboxDeadLetter,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { SUPPORT_CASE_LABELS } from "@/lib/gifts/labels";

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function StatusPill({ value }: { value: string }) {
  return (
    <span className="rounded-full bg-kindly-accent-soft px-2 py-0.5 text-[10px] font-extrabold text-kindly-accent">
      {value.replaceAll("_", " ").toLowerCase()}
    </span>
  );
}

function statusFilter(label: string, options: string[]) {
  return {
    label,
    options: [
      { value: "", label: "All" },
      ...options.map((value) => ({
        value,
        label: value.replaceAll("_", " ").toLowerCase(),
      })),
    ],
    predicate: (row: { status: string }, value: string) => row.status === value,
  };
}

function SupportCaseDetail({
  item,
  mfaToken,
  onChanged,
}: {
  item: AdminSupportCase;
  mfaToken: string;
  onChanged: () => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<AdminSupportCase | null>(null);

  async function handleResolve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (note.trim().length < 5) {
      setError("Resolution note must be at least 5 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await resolveSupportCase(mfaToken, item.id, note.trim());
      setResolved(updated);
      setNote("");
      await onChanged();
    } catch (resolveError) {
      setError(
        resolveError instanceof ApiError
          ? resolveError.message
          : "Could not resolve the support case.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <dl className="grid gap-2 rounded-2xl bg-kindly-accent-soft/50 p-3 sm:grid-cols-2">
        <div>
          <dt className="text-[10px] font-extrabold tracking-wide text-kindly-muted uppercase">
            Reporter
          </dt>
          <dd className="mt-0.5">{item.reporterDisplayName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-extrabold tracking-wide text-kindly-muted uppercase">
            Amount
          </dt>
          <dd className="mt-0.5">₹{item.amountInr}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-extrabold tracking-wide text-kindly-muted uppercase">
            Donor / recipient
          </dt>
          <dd className="mt-0.5">
            {item.donorDisplayName ?? "—"} / {item.recipientDisplayName ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-extrabold tracking-wide text-kindly-muted uppercase">
            Gift / wish
          </dt>
          <dd className="mt-0.5">
            {item.giftStatus} / {item.wishStatus}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-extrabold tracking-wide text-kindly-muted uppercase">
            Payment reference
          </dt>
          <dd className="mt-0.5">{item.paymentRefCode}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-extrabold tracking-wide text-kindly-muted uppercase">
            Masked VPA / UTR
          </dt>
          <dd className="mt-0.5">
            {item.recipientMaskedVpa ?? "—"} / {item.utrReference ?? "—"}
          </dd>
        </div>
      </dl>

      <div className="rounded-2xl border border-kindly-border p-3">
        <p className="text-xs font-extrabold tracking-wide text-kindly-muted uppercase">
          What the user said
        </p>
        <p className="mt-1 whitespace-pre-wrap">{item.description}</p>
      </div>

      {resolved?.resolutionNote || item.resolutionNote ? (
        <p className="rounded-2xl bg-green-50 p-3 text-green-900">
          Resolution: {resolved?.resolutionNote ?? item.resolutionNote} (
          {formatDate(resolved?.resolvedAt ?? item.resolvedAt)})
        </p>
      ) : (
        <form
          onSubmit={handleResolve}
          className="space-y-2 rounded-2xl border border-kindly-border p-3"
        >
          <label htmlFor={`resolution-${item.id}`} className="kindly-label">
            Resolution note
          </label>
          <textarea
            id={`resolution-${item.id}`}
            rows={3}
            maxLength={1000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="kindly-input mt-1"
          />
          {error && (
            <p role="alert" className="kindly-status-error">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className="kindly-btn-primary !min-h-9">
            {busy ? "Resolving…" : "Resolve case"}
          </button>
        </form>
      )}
    </div>
  );
}

export function AdminSupportTable({
  cases,
  mfaToken,
  onChanged,
}: {
  cases: AdminSupportCase[];
  mfaToken: string;
  onChanged: () => Promise<void>;
}) {
  return (
    <AdminQueueTable
      title="Support cases"
      description="Search payment and gift support cases, open the detail and resolve with an audited note."
      rows={cases}
      columns={[
        {
          header: "Case",
          render: (item) => (
            <div>
              <p className="font-semibold">
                {SUPPORT_CASE_LABELS[item.caseType]} · ₹{item.amountInr}
              </p>
              <p className="line-clamp-1 text-[10px] text-kindly-muted">{item.description}</p>
            </div>
          ),
        },
        {
          header: "Reporter",
          render: (item) => item.reporterDisplayName ?? "—",
        },
        {
          header: "Status",
          render: (item) => <StatusPill value={item.status} />,
        },
        {
          header: "Created",
          render: (item) => (
            <span className="text-xs text-kindly-muted">{formatDate(item.createdAt)}</span>
          ),
        },
      ]}
      searchText={(item) =>
        `${item.caseType} ${item.status} ${item.reporterDisplayName ?? ""} ${
          item.donorDisplayName ?? ""
        } ${item.recipientDisplayName ?? ""} ${item.description} ${item.paymentRefCode}`
      }
      getKey={(item) => item.id}
      detailTitle={(item) => `${SUPPORT_CASE_LABELS[item.caseType]} · ${item.id.slice(0, 8)}`}
      renderDetail={(item) => (
        <SupportCaseDetail item={item} mfaToken={mfaToken} onChanged={onChanged} />
      )}
      filter={statusFilter("Case status", ["OPEN", "UNDER_REVIEW", "RESOLVED", "CLOSED"])}
      emptyMessage="No support cases match."
    />
  );
}

export function AdminAppealsTable({
  appeals,
  mfaToken,
  onChanged,
}: {
  appeals: AdminAppeal[];
  mfaToken: string;
  onChanged: () => Promise<void>;
}) {
  return (
    <AdminQueueTable
      title="Appeals"
      description="Review moderated users' appeals and resolve them with a mandatory audited note."
      rows={appeals}
      columns={[
        {
          header: "User / action",
          render: (item) => (
            <div>
              <p className="font-semibold">{item.userDisplayName ?? "Unknown user"}</p>
              <p className="text-[10px] text-kindly-muted">{item.action}</p>
            </div>
          ),
        },
        {
          header: "Status",
          render: (item) => <StatusPill value={item.status} />,
        },
        {
          header: "Original reason",
          render: (item) => (
            <span className="line-clamp-1 text-xs text-kindly-muted">{item.actionReason}</span>
          ),
        },
        {
          header: "Created",
          render: (item) => (
            <span className="text-xs text-kindly-muted">{formatDate(item.createdAt)}</span>
          ),
        },
      ]}
      searchText={(item) =>
        `${item.userDisplayName ?? ""} ${item.action} ${item.actionReason} ${item.reason} ${
          item.status
        }`
      }
      getKey={(item) => item.id}
      detailTitle={(item) => `${item.userDisplayName ?? "Unknown user"} · ${item.action}`}
      renderDetail={(item) => (
        <div className="space-y-4 text-sm">
          <dl className="grid gap-2 rounded-2xl bg-kindly-accent-soft/50 p-3 sm:grid-cols-2">
            <div>
              <dt className="text-[10px] font-extrabold tracking-wide text-kindly-muted uppercase">
                Original action
              </dt>
              <dd className="mt-0.5">{item.action}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-extrabold tracking-wide text-kindly-muted uppercase">
                Original reason
              </dt>
              <dd className="mt-0.5">{item.actionReason}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-extrabold tracking-wide text-kindly-muted uppercase">
                Target
              </dt>
              <dd className="mt-0.5">{item.targetType}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-extrabold tracking-wide text-kindly-muted uppercase">
                Submitted
              </dt>
              <dd className="mt-0.5">{formatDate(item.createdAt)}</dd>
            </div>
          </dl>
          <div className="rounded-2xl border border-kindly-border p-3">
            <p className="text-xs font-extrabold tracking-wide text-kindly-muted uppercase">
              Appeal
            </p>
            <p className="mt-1 whitespace-pre-wrap">{item.reason}</p>
          </div>
          {item.status === "OPEN" || item.status === "UNDER_REVIEW" ? (
            <AppealResolutionForm mfaToken={mfaToken} appealId={item.id} onResolved={onChanged} />
          ) : (
            item.resolutionNote && (
              <p className="rounded-2xl bg-green-50 p-3 text-green-900">
                Resolution: {item.resolutionNote} ({formatDate(item.resolvedAt)})
              </p>
            )
          )}
        </div>
      )}
      filter={statusFilter("Appeal status", ["OPEN", "UNDER_REVIEW", "ACCEPTED", "REJECTED"])}
      emptyMessage="No appeals match."
    />
  );
}

export function AdminDeletionTable({ requests }: { requests: AdminDeletionRequest[] }) {
  return (
    <AdminQueueTable
      title="Deletion requests"
      description="Review non-destructive account deletion requests. Financial and audit records are not deleted here."
      rows={requests}
      columns={[
        {
          header: "User",
          render: (item) => (
            <div>
              <p className="font-semibold">{item.userDisplayName ?? "Unknown user"}</p>
              <p className="text-[10px] text-kindly-muted">{item.userStatus}</p>
            </div>
          ),
        },
        {
          header: "Request",
          render: (item) => <StatusPill value={item.status} />,
        },
        {
          header: "Requested",
          render: (item) => (
            <span className="text-xs text-kindly-muted">{formatDate(item.requestedAt)}</span>
          ),
        },
      ]}
      searchText={(item) =>
        `${item.userDisplayName ?? ""} ${item.userStatus} ${item.status} ${item.reason ?? ""}`
      }
      getKey={(item) => item.id}
      detailTitle={(item) => item.userDisplayName ?? "Deletion request"}
      renderDetail={(item) => (
        <div className="space-y-3 text-sm">
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
            This queue records requests only. Do not delete or anonymise financial or audit records
            until counsel-approved retention is in place.
          </p>
          <dl className="grid gap-2 rounded-2xl bg-kindly-accent-soft/50 p-3 sm:grid-cols-2">
            <div>
              <dt className="text-[10px] font-extrabold tracking-wide text-kindly-muted uppercase">
                User status
              </dt>
              <dd className="mt-0.5">{item.userStatus}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-extrabold tracking-wide text-kindly-muted uppercase">
                Request status
              </dt>
              <dd className="mt-0.5">{item.status}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-extrabold tracking-wide text-kindly-muted uppercase">
                Requested
              </dt>
              <dd className="mt-0.5">{formatDate(item.requestedAt)}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-extrabold tracking-wide text-kindly-muted uppercase">
                Cancelled
              </dt>
              <dd className="mt-0.5">{formatDate(item.cancelledAt)}</dd>
            </div>
          </dl>
          {item.reason && (
            <div className="rounded-2xl border border-kindly-border p-3">
              <p className="text-xs font-extrabold tracking-wide text-kindly-muted uppercase">
                Reason
              </p>
              <p className="mt-1 whitespace-pre-wrap">{item.reason}</p>
            </div>
          )}
        </div>
      )}
      filter={statusFilter("Request status", ["REQUESTED", "CANCELLED", "COMPLETED"])}
      emptyMessage="No deletion requests match."
      note={
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Requests are recorded only. No destructive deletion action is available from this console.
        </p>
      }
    />
  );
}

export function AdminOutboxTable({ deadLetters }: { deadLetters: OutboxDeadLetter[] }) {
  const eventTypes = Array.from(new Set(deadLetters.map((item) => item.eventType)));
  return (
    <AdminQueueTable
      title="Outbox dead letters"
      description="Inspect failed outbox events. Domain state is already committed; retries belong in an approved idempotent handler."
      rows={deadLetters}
      columns={[
        {
          header: "Event",
          render: (item) => <span className="font-semibold">{item.eventType}</span>,
        },
        {
          header: "Aggregate",
          render: (item) => (
            <span className="text-xs text-kindly-muted">
              {item.aggregateType} · {item.aggregateId.slice(0, 8)}
            </span>
          ),
        },
        {
          header: "Attempts",
          render: (item) => item.attempts,
        },
        {
          header: "Created",
          render: (item) => (
            <span className="text-xs text-kindly-muted">{formatDate(item.createdAt)}</span>
          ),
        },
      ]}
      searchText={(item) =>
        `${item.eventType} ${item.aggregateType} ${item.aggregateId} ${item.deadLetterReason ?? ""}`
      }
      getKey={(item) => item.id}
      detailTitle={(item) => item.eventType}
      renderDetail={(item) => (
        <div className="space-y-3 text-sm">
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
            Dead-lettered events need investigation. Do not replay by changing domain state; use an
            approved idempotent handler.
          </p>
          <dl className="grid gap-2 rounded-2xl bg-kindly-accent-soft/50 p-3 sm:grid-cols-2">
            <div>
              <dt className="text-[10px] font-extrabold tracking-wide text-kindly-muted uppercase">
                Aggregate
              </dt>
              <dd className="mt-0.5">
                {item.aggregateType} · {item.aggregateId}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-extrabold tracking-wide text-kindly-muted uppercase">
                Attempts
              </dt>
              <dd className="mt-0.5">{item.attempts}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-extrabold tracking-wide text-kindly-muted uppercase">
                Created
              </dt>
              <dd className="mt-0.5">{formatDate(item.createdAt)}</dd>
            </div>
          </dl>
          <div className="rounded-2xl border border-kindly-border p-3">
            <p className="text-xs font-extrabold tracking-wide text-kindly-muted uppercase">
              Dead-letter reason
            </p>
            <p className="mt-1 whitespace-pre-wrap">{item.deadLetterReason ?? "—"}</p>
          </div>
        </div>
      )}
      filter={{
        label: "Event type",
        options: [
          { value: "", label: "All" },
          ...eventTypes.map((value) => ({ value, label: value })),
        ],
        predicate: (item, value) => item.eventType === value,
      }}
      emptyMessage="No dead-lettered events match."
    />
  );
}

export function AdminAuditTable({ logs }: { logs: AdminAuditLog[] }) {
  const targetTypes = Array.from(new Set(logs.map((item) => item.targetType)));
  return (
    <AdminQueueTable
      title="Audit log"
      description="Append-only admin actions with actor, target, request ID and reason."
      rows={logs}
      columns={[
        {
          header: "Action",
          render: (item) => <span className="font-semibold">{item.action}</span>,
        },
        {
          header: "Actor",
          render: (item) => item.actorDisplayName ?? "System",
        },
        {
          header: "Target",
          render: (item) => (
            <span className="text-xs text-kindly-muted">
              {item.targetType}
              {item.targetId ? ` · ${item.targetId.slice(0, 8)}` : ""}
            </span>
          ),
        },
        {
          header: "Created",
          render: (item) => (
            <span className="text-xs text-kindly-muted">{formatDate(item.createdAt)}</span>
          ),
        },
      ]}
      searchText={(item) =>
        `${item.action} ${item.actorDisplayName ?? ""} ${item.targetType} ${
          item.targetId ?? ""
        } ${item.reason ?? ""} ${item.requestId ?? ""}`
      }
      getKey={(item) => item.id}
      detailTitle={(item) => item.action}
      renderDetail={(item) => (
        <div className="space-y-3 text-sm">
          <dl className="grid gap-2 rounded-2xl bg-kindly-accent-soft/50 p-3 sm:grid-cols-2">
            <div>
              <dt className="text-[10px] font-extrabold tracking-wide text-kindly-muted uppercase">
                Actor
              </dt>
              <dd className="mt-0.5">{item.actorDisplayName ?? "System"}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-extrabold tracking-wide text-kindly-muted uppercase">
                Target
              </dt>
              <dd className="mt-0.5">
                {item.targetType}
                {item.targetId ? ` · ${item.targetId}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-extrabold tracking-wide text-kindly-muted uppercase">
                Request ID
              </dt>
              <dd className="mt-0.5">{item.requestId ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-extrabold tracking-wide text-kindly-muted uppercase">
                Created
              </dt>
              <dd className="mt-0.5">{formatDate(item.createdAt)}</dd>
            </div>
          </dl>
          {item.reason && (
            <div className="rounded-2xl border border-kindly-border p-3">
              <p className="text-xs font-extrabold tracking-wide text-kindly-muted uppercase">
                Reason
              </p>
              <p className="mt-1 whitespace-pre-wrap">{item.reason}</p>
            </div>
          )}
        </div>
      )}
      filter={{
        label: "Target type",
        options: [
          { value: "", label: "All" },
          ...targetTypes.map((value) => ({ value, label: value })),
        ],
        predicate: (item, value) => item.targetType === value,
      }}
      emptyMessage="No audit events match."
    />
  );
}
