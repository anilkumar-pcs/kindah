"use client";

import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import {
  AdminAppealsTable,
  AdminAuditTable,
  AdminDeletionTable,
  AdminOutboxTable,
  AdminSupportTable,
} from "@/components/admin/admin-queues";
import { AdminUserTable } from "@/components/admin/admin-user-table";
import { AdminWishTable } from "@/components/admin/admin-wish-table";
import { BadgeDefinitionsPanel } from "@/components/admin/badge-definitions-panel";
import { ModerationActionForm } from "@/components/admin/moderation-action-form";
import {
  enableAdminMfa,
  getAdminMfaStatus,
  listAdminAppeals,
  listAdminAuditLogs,
  listAdminBadges,
  listAdminDeletionRequests,
  listAdminOutboxDeadLetters,
  listAdminReports,
  listAdminSupportCases,
  setupAdminMfa,
  verifyAdminMfa,
  type AdminAppeal,
  type AdminAuditLog,
  type AdminDeletionRequest,
  type AdminMfaStatus,
  type AdminReport,
  type AdminSupportCase,
  type BadgeDefinition,
  type MfaSetup,
  type OutboxDeadLetter,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { REPORT_REASON_LABELS } from "@/lib/api/safety";
import { restoreSession, type UserProfile } from "@/lib/auth/session";

type PageState = "loading" | "guest" | "denied" | "ready" | "error";
type AdminTab =
  | "reports"
  | "support"
  | "appeals"
  | "deletion"
  | "users"
  | "wishes"
  | "badges"
  | "outbox"
  | "audit";

type AdminData = {
  reports: AdminReport[];
  supportCases: AdminSupportCase[];
  appeals: AdminAppeal[];
  deletionRequests: AdminDeletionRequest[];
  badges: BadgeDefinition[];
  deadLetters: OutboxDeadLetter[];
  auditLogs: AdminAuditLog[];
};

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return "Something went wrong. Try again.";
}

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function isMfaError(error: unknown): boolean {
  return error instanceof ApiError && error.code === "MFA_REQUIRED";
}

export function AdminConsole() {
  const [state, setState] = useState<PageState>("loading");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<AdminMfaStatus | null>(null);
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [data, setData] = useState<AdminData | null>(null);
  const [tab, setTab] = useState<AdminTab>("reports");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    restoreSession()
      .then(async (session) => {
        if (cancelled) {
          return;
        }
        if (!session) {
          setState("guest");
          return;
        }
        if (!session.role || session.role === "USER") {
          setState("denied");
          return;
        }
        setUser(session);
        const mfaStatus = await getAdminMfaStatus();
        if (!cancelled) {
          setStatus(mfaStatus);
          if (!mfaStatus.mfaRequired) {
            const token = "mfa-not-required";
            setMfaToken(token);
            await loadData(token);
          }
          setState("ready");
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(errorMessage(loadError));
          setState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function loadData(token: string) {
    const [reports, supportCases, appeals, deletionRequests, badges, deadLetters, auditLogs] =
      await Promise.all([
        listAdminReports(token),
        listAdminSupportCases(token),
        listAdminAppeals(token),
        listAdminDeletionRequests(token),
        listAdminBadges(token),
        listAdminOutboxDeadLetters(token),
        listAdminAuditLogs(token),
      ]);
    setData({
      reports,
      supportCases,
      appeals,
      deletionRequests,
      badges,
      deadLetters,
      auditLogs,
    });
  }

  async function handleStartSetup() {
    setBusy(true);
    setError(null);
    try {
      setSetup(await setupAdminMfa());
    } catch (setupError) {
      setError(errorMessage(setupError));
    } finally {
      setBusy(false);
    }
  }

  async function handleEnable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const enabled = await enableAdminMfa(code.trim());
      setRecoveryCodes(enabled.recoveryCodes);
      setMfaToken(enabled.mfaToken);
      setStatus((current) =>
        current
          ? { ...current, mfaEnabled: true, recoveryCodesRemaining: enabled.recoveryCodes.length }
          : current,
      );
      setCode("");
      await loadData(enabled.mfaToken);
    } catch (enableError) {
      setError(errorMessage(enableError));
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const verified = await verifyAdminMfa(code.trim());
      setMfaToken(verified.mfaToken);
      setCode("");
      await loadData(verified.mfaToken);
    } catch (verifyError) {
      if (isMfaError(verifyError)) {
        setMfaToken(null);
      }
      setError(errorMessage(verifyError));
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") {
    return (
      <section aria-busy="true" aria-live="polite" className="kindly-card mx-auto max-w-3xl p-6">
        <p className="text-sm text-kindly-muted">Checking admin access…</p>
      </section>
    );
  }

  if (state === "guest") {
    return (
      <section className="kindly-card mx-auto max-w-xl p-6 sm:p-8">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.055em]">Admin sign in</h1>
        <p className="mt-3 text-sm text-kindly-muted">
          Sign in with an authorized moderator or administrator account.
        </p>
        <Link
          href="/sign-in"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-kindly-accent px-5 py-3 text-sm font-semibold text-white hover:bg-kindly-accent-dark"
        >
          Sign in
        </Link>
      </section>
    );
  }

  if (state === "denied") {
    return (
      <section className="kindly-card mx-auto max-w-xl p-6 sm:p-8">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.055em]">
          Admin access required
        </h1>
        <p role="alert" className="kindly-status-error mt-3">
          This account does not have moderator or administrator access.
        </p>
        <Link href="/" className="kindly-btn-quiet mt-4 !px-0">
          Back to discovery
        </Link>
      </section>
    );
  }

  if (state === "error") {
    return (
      <section className="kindly-card mx-auto max-w-xl p-6 sm:p-8">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.055em]">
          Admin unavailable
        </h1>
        <p role="alert" className="kindly-status-error mt-3">
          {error ?? "Could not load the admin area."}
        </p>
        <Link href="/" className="kindly-btn-quiet mt-4 !px-0">
          Back to discovery
        </Link>
      </section>
    );
  }

  const unlocked = Boolean(mfaToken && data);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="kindly-card p-5">
        <p className="text-sm font-semibold tracking-wide text-kindly-accent uppercase">
          Protected operations
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-display text-3xl font-semibold tracking-[-0.055em]">Admin console</h1>
          <span className="rounded-full bg-kindly-accent-soft px-3 py-1 text-xs font-semibold text-kindly-accent">
            {status?.role ?? user?.role}
          </span>
        </div>
        <p className="mt-2 text-sm text-kindly-muted">
          {status?.mfaRequired
            ? "Moderator actions require a verified authenticator session."
            : "Admin access is granted by the database role (MFA is currently disabled by owner policy)."}{" "}
          Never share payment details, UTRs or moderation notes outside this console.
        </p>
        {unlocked && status?.mfaRequired && (
          <button
            type="button"
            onClick={() => {
              setMfaToken(null);
              setData(null);
              setCode("");
            }}
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl border border-kindly-border px-4 py-2 text-sm font-semibold hover:bg-kindly-accent-soft"
          >
            Lock admin session
          </button>
        )}
      </header>

      {error && (
        <p role="alert" className="kindly-status-error">
          {error}
        </p>
      )}

      {recoveryCodes.length > 0 && (
        <section className="rounded-[1.5rem] border border-kindly-marigold/50 bg-kindly-marigold/20 p-5 text-sm text-kindly-ink">
          <h2 className="font-display text-2xl font-semibold tracking-[-0.04em]">
            Save your recovery codes
          </h2>
          <p className="mt-1">
            Each code works once. Store them offline; they will not be shown again.
          </p>
          <ul className="mt-3 grid gap-1 font-mono sm:grid-cols-2">
            {recoveryCodes.map((value) => (
              <li key={value}>{value}</li>
            ))}
          </ul>
        </section>
      )}

      {status && status.mfaRequired && !status.mfaEnabled && !setup && (
        <section className="kindly-card p-5">
          <h2 className="font-display text-2xl font-semibold tracking-[-0.04em]">
            Set up authenticator MFA
          </h2>
          <p className="mt-1 text-sm text-kindly-muted">
            Admin routes stay locked until an authenticator app is enrolled.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={handleStartSetup}
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-kindly-accent px-5 py-3 text-sm font-semibold text-white hover:bg-kindly-accent-dark disabled:opacity-60"
          >
            {busy ? "Preparing…" : "Set up authenticator"}
          </button>
        </section>
      )}

      {setup && status?.mfaRequired && !mfaToken && (
        <section className="kindly-card p-5">
          <h2 className="font-display text-2xl font-semibold tracking-[-0.04em]">
            Scan and confirm
          </h2>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div
              aria-label="Authenticator setup QR code"
              className="w-fit rounded-xl border border-kindly-border p-3"
            >
              <QRCodeSVG value={setup.otpauthUri} size={168} level="M" />
            </div>
            <div className="space-y-2 text-sm">
              <p className="text-kindly-muted">Manual setup secret</p>
              <p className="break-all font-mono font-semibold">{setup.secret}</p>
              <p className="text-kindly-muted">
                Enter the current six-digit code after adding the account.
              </p>
            </div>
          </div>
          <form onSubmit={handleEnable} className="mt-4 flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="mfa-enable-code" className="kindly-label">
                Authenticator code
              </label>
              <input
                id="mfa-enable-code"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="kindly-input mt-1"
              />
            </div>
            <button type="submit" disabled={busy} className="kindly-btn-primary">
              {busy ? "Enabling…" : "Enable MFA"}
            </button>
          </form>
        </section>
      )}

      {status?.mfaRequired && status.mfaEnabled && !mfaToken && (
        <section className="kindly-card p-5">
          <h2 className="font-display text-2xl font-semibold tracking-[-0.04em]">Verify MFA</h2>
          <p className="mt-1 text-sm text-kindly-muted">
            Enter an authenticator code or a one-time recovery code.
          </p>
          <form onSubmit={handleVerify} className="mt-3 flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="mfa-verify-code" className="kindly-label">
                Authenticator or recovery code
              </label>
              <input
                id="mfa-verify-code"
                type="text"
                autoComplete="one-time-code"
                maxLength={32}
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="kindly-input mt-1"
              />
            </div>
            <button type="submit" disabled={busy} className="kindly-btn-primary">
              {busy ? "Verifying…" : "Open admin console"}
            </button>
          </form>
          <p className="mt-3 text-xs text-kindly-muted">
            Recovery codes remaining: {status.recoveryCodesRemaining}
          </p>
        </section>
      )}

      {unlocked && data && (
        <>
          <nav
            aria-label="Admin sections"
            className="flex flex-wrap gap-1 rounded-2xl border border-kindly-border bg-kindly-card p-1"
          >
            {(
              [
                ["reports", `Reports (${data.reports.length})`],
                ["support", `Support cases (${data.supportCases.length})`],
                ["appeals", `Appeals (${data.appeals.length})`],
                ["deletion", `Deletion (${data.deletionRequests.length})`],
                ["users", "Users"],
                ["wishes", "Wishes"],
                ["badges", `Badges (${data.badges.length})`],
                ["outbox", `Outbox (${data.deadLetters.length})`],
                ["audit", `Audit log (${data.auditLogs.length})`],
              ] as Array<[AdminTab, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={tab === value}
                onClick={() => setTab(value)}
                className={`min-h-11 rounded-xl px-3 py-2 text-sm font-semibold ${
                  tab === value
                    ? "bg-kindly-accent text-white"
                    : "text-kindly-muted hover:bg-kindly-accent-soft"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          {tab === "reports" && (
            <section aria-labelledby="admin-reports-heading" className="space-y-3">
              <h2
                id="admin-reports-heading"
                className="font-display text-2xl font-semibold tracking-[-0.04em]"
              >
                Moderation queue
              </h2>
              {data.reports.length === 0 ? (
                <p className="kindly-card p-5 text-sm text-kindly-muted">No open reports.</p>
              ) : (
                data.reports.map((report) => (
                  <article key={report.id} className="kindly-card p-5 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">
                        {report.targetDisplayName ?? "Unknown target"} ·{" "}
                        {REPORT_REASON_LABELS[report.reason]}
                      </span>
                      <span className="rounded-full bg-kindly-accent-soft px-3 py-1 text-xs font-semibold">
                        {report.uniqueReportCount} unique report
                        {report.uniqueReportCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="mt-2 text-kindly-muted">
                      {report.targetType} · {report.targetStatus} · reported{" "}
                      {formatDate(report.createdAt)}
                    </p>
                    {report.targetPreview && <p className="mt-2">{report.targetPreview}</p>}
                    <p className="mt-2 text-xs text-kindly-muted">
                      Report {report.id.slice(0, 8)} · target {report.targetId.slice(0, 8)}
                    </p>
                    <ModerationActionForm
                      mfaToken={mfaToken ?? ""}
                      targetType={report.targetType}
                      targetId={report.targetId}
                      onApplied={async () => {
                        if (mfaToken) {
                          await loadData(mfaToken);
                        }
                      }}
                    />
                  </article>
                ))
              )}
            </section>
          )}

          {tab === "support" && (
            <AdminSupportTable
              mfaToken={mfaToken ?? ""}
              onChanged={async () => {
                if (mfaToken) {
                  await loadData(mfaToken);
                }
              }}
            />
          )}

          {tab === "appeals" && (
            <AdminAppealsTable
              mfaToken={mfaToken ?? ""}
              onChanged={async () => {
                if (mfaToken) {
                  await loadData(mfaToken);
                }
              }}
            />
          )}

          {tab === "deletion" && <AdminDeletionTable mfaToken={mfaToken ?? ""} />}

          {tab === "users" && (
            <AdminUserTable
              mfaToken={mfaToken ?? ""}
              currentUserId={user?.id ?? ""}
              onChanged={async () => {
                if (mfaToken) {
                  await loadData(mfaToken);
                }
              }}
            />
          )}

          {tab === "wishes" && (
            <AdminWishTable
              mfaToken={mfaToken ?? ""}
              onChanged={async () => {
                if (mfaToken) {
                  await loadData(mfaToken);
                }
              }}
            />
          )}

          {tab === "badges" && (
            <BadgeDefinitionsPanel
              mfaToken={mfaToken ?? ""}
              definitions={data.badges}
              onChanged={async () => {
                if (mfaToken) {
                  await loadData(mfaToken);
                }
              }}
            />
          )}

          {tab === "outbox" && <AdminOutboxTable mfaToken={mfaToken ?? ""} />}

          {tab === "audit" && <AdminAuditTable mfaToken={mfaToken ?? ""} />}
        </>
      )}
    </div>
  );
}
