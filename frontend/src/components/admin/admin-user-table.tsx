"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { ModerationActionForm } from "@/components/admin/moderation-action-form";
import { Icon } from "@/components/ui/icon";
import {
  listAdminUsersPage,
  updateUserRole,
  type AdminUser,
  type AdminUserPage,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";

type Props = {
  mfaToken: string;
  currentUserId: string;
  onChanged: () => Promise<void>;
};

const USER_STATUSES = [
  ["", "All statuses"],
  ["ACTIVE", "Active"],
  ["RESTRICTED", "Restricted"],
  ["SUSPENDED", "Suspended"],
  ["BANNED", "Banned"],
  ["DELETION_PENDING", "Deletion pending"],
] as const;

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Could not load users.";
}

function statusLabel(status: string): string {
  return status.replaceAll("_", " ").toLowerCase();
}

export function AdminUserTable({ mfaToken, currentUserId, onChanged }: Props) {
  const [data, setData] = useState<AdminUserPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queryDraft, setQueryDraft] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [role, setRole] = useState<AdminUser["role"]>("USER");
  const [roleReason, setRoleReason] = useState("");
  const [roleBusy, setRoleBusy] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [roleMessage, setRoleMessage] = useState<string | null>(null);
  const [statusActionsOpen, setStatusActionsOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    listAdminUsersPage(mfaToken, {
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

  function openUser(item: AdminUser) {
    setSelected(item);
    setRole(item.role);
    setRoleReason("");
    setRoleError(null);
    setRoleMessage(null);
    setStatusActionsOpen(false);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setPage(1);
    setQuery(queryDraft.trim());
    setReloadKey((current) => current + 1);
  }

  async function handleRoleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) {
      return;
    }
    if (roleReason.trim().length < 5) {
      setRoleError("A reason of at least 5 characters is required for a role change.");
      return;
    }
    setRoleBusy(true);
    setRoleError(null);
    setRoleMessage(null);
    try {
      const updated = await updateUserRole(mfaToken, selected.id, role, roleReason.trim());
      setSelected(updated);
      setData((current) =>
        current
          ? {
              ...current,
              users: current.users.map((item) => (item.id === updated.id ? updated : item)),
            }
          : current,
      );
      setRoleReason("");
      setRoleMessage("Role updated with an audit entry.");
      await onChanged();
    } catch (updateError) {
      setRoleError(errorMessage(updateError));
    } finally {
      setRoleBusy(false);
    }
  }

  const totalPages = data ? Math.max(Math.ceil(data.total / data.pageSize), 1) : 1;

  return (
    <section aria-labelledby="admin-users-heading" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2
            id="admin-users-heading"
            className="font-display text-2xl font-semibold tracking-[-0.04em]"
          >
            Users
          </h2>
          <p className="mt-1 text-sm text-kindly-muted">
            Search, filter and manage roles or account status. Every change needs a reason and is
            audited.
          </p>
        </div>
        <span className="text-xs font-semibold text-kindly-muted">
          {data ? `${data.total} total` : "Loading…"}
        </span>
      </div>

      <form
        onSubmit={submitSearch}
        role="search"
        aria-label="Search users"
        className="flex flex-wrap items-end gap-2 rounded-2xl border border-kindly-border bg-kindly-card p-3"
      >
        <div className="min-w-48 flex-1">
          <label htmlFor="admin-user-search" className="kindly-label">
            Search by pseudonym
          </label>
          <input
            id="admin-user-search"
            type="search"
            maxLength={60}
            value={queryDraft}
            onChange={(event) => setQueryDraft(event.target.value)}
            className="kindly-input mt-1"
          />
        </div>
        <div>
          <label htmlFor="admin-user-status" className="kindly-label">
            Account status
          </label>
          <select
            id="admin-user-status"
            value={status}
            onChange={(event) => {
              setLoading(true);
              setStatus(event.target.value);
              setPage(1);
            }}
            className="kindly-input mt-1 !min-h-10"
          >
            {USER_STATUSES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
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

      <div className="overflow-x-auto rounded-2xl border border-kindly-border bg-kindly-card">
        <table className="w-full min-w-[680px] text-left text-sm">
          <caption className="sr-only">Users and account roles</caption>
          <thead className="border-b border-kindly-border bg-kindly-cream/70 text-[10px] tracking-[0.12em] text-kindly-muted uppercase">
            <tr>
              <th scope="col" className="px-3 py-2.5 font-extrabold">
                User
              </th>
              <th scope="col" className="px-3 py-2.5 font-extrabold">
                Role
              </th>
              <th scope="col" className="px-3 py-2.5 font-extrabold">
                Status
              </th>
              <th scope="col" className="px-3 py-2.5 font-extrabold">
                Joined
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-extrabold">
                Action
              </th>
            </tr>
          </thead>
          <tbody aria-busy={loading}>
            {data?.users.map((item) => (
              <tr key={item.id} className="border-b border-kindly-border/60 last:border-0">
                <td className="px-3 py-2.5">
                  <p className="font-semibold">{item.displayName ?? "Unnamed user"}</p>
                  <p className="text-[10px] text-kindly-muted">{item.id.slice(0, 8)}</p>
                </td>
                <td className="px-3 py-2.5">
                  <span className="rounded-full bg-kindly-accent-soft px-2 py-0.5 text-[10px] font-extrabold text-kindly-accent">
                    {item.role}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-xs capitalize">{statusLabel(item.status)}</td>
                <td className="px-3 py-2.5 text-xs text-kindly-muted">
                  {formatDate(item.createdAt)}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button
                    type="button"
                    aria-label={`Manage ${item.displayName ?? "user"}`}
                    onClick={() => openUser(item)}
                    className="kindly-btn-quiet !min-h-8 !px-2 !text-xs"
                  >
                    Manage
                  </button>
                </td>
              </tr>
            ))}
            {!loading && data?.users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-kindly-muted">
                  No matching users.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
          aria-labelledby="admin-user-detail-title"
        >
          <button
            type="button"
            aria-label="Dismiss user details"
            className="absolute inset-0 bg-kindly-ink/35 backdrop-blur-[2px]"
            onClick={() => setSelected(null)}
          />
          <section className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto bg-kindly-card p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="kindly-eyebrow">User detail</p>
                <h3
                  id="admin-user-detail-title"
                  className="mt-1 font-display text-2xl font-semibold tracking-[-0.04em]"
                >
                  {selected.displayName ?? "Unnamed user"}
                </h3>
                <p className="mt-1 text-xs text-kindly-muted">
                  {selected.id} · {statusLabel(selected.status)} · joined{" "}
                  {formatDate(selected.createdAt)}
                </p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setSelected(null)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-kindly-border"
              >
                <span className="sr-only">Close user details</span>
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={handleRoleUpdate}
              className="mt-5 space-y-2 rounded-2xl border border-kindly-border p-3"
            >
              <p className="font-bold">Role</p>
              <div>
                <label htmlFor={`role-${selected.id}`} className="kindly-label">
                  Database role
                </label>
                <select
                  id={`role-${selected.id}`}
                  value={role}
                  onChange={(event) => setRole(event.target.value as AdminUser["role"])}
                  disabled={selected.id === currentUserId}
                  className="kindly-input mt-1"
                >
                  <option value="USER">USER</option>
                  <option value="MODERATOR">MODERATOR</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <div>
                <label htmlFor={`role-reason-${selected.id}`} className="kindly-label">
                  Reason (mandatory)
                </label>
                <input
                  id={`role-reason-${selected.id}`}
                  type="text"
                  minLength={5}
                  maxLength={1000}
                  value={roleReason}
                  onChange={(event) => setRoleReason(event.target.value)}
                  className="kindly-input mt-1"
                />
              </div>
              {roleError && (
                <p role="alert" className="kindly-status-error">
                  {roleError}
                </p>
              )}
              {roleMessage && (
                <p aria-live="polite" className="kindly-status-success">
                  {roleMessage}
                </p>
              )}
              <button
                type="submit"
                disabled={roleBusy || selected.id === currentUserId}
                className="kindly-btn-primary !min-h-9"
              >
                {selected.id === currentUserId
                  ? "This is you"
                  : roleBusy
                    ? "Updating…"
                    : "Update role"}
              </button>
            </form>

            <div className="mt-4 rounded-2xl border border-kindly-border p-3">
              <button
                type="button"
                onClick={() => setStatusActionsOpen((open) => !open)}
                aria-expanded={statusActionsOpen}
                className="flex min-h-9 w-full items-center justify-between text-left text-sm font-bold"
              >
                Status actions
                <Icon
                  name="chevron-down"
                  className={`h-4 w-4 transition-transform ${statusActionsOpen ? "rotate-180" : ""}`}
                />
              </button>
              {statusActionsOpen ? (
                <>
                  <p className="mt-1 text-xs leading-5 text-kindly-muted">
                    Warn, restrict, suspend, ban or reactivate. The server guards self-targeting and
                    privileged accounts.
                  </p>
                  <ModerationActionForm
                    mfaToken={mfaToken}
                    targetType="USER"
                    targetId={selected.id}
                    onApplied={async () => {
                      setLoading(true);
                      setReloadKey((current) => current + 1);
                      await onChanged();
                    }}
                  />
                </>
              ) : (
                <p className="mt-1 text-xs text-kindly-muted">
                  Reveal guarded status controls and the mandatory reason field.
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
