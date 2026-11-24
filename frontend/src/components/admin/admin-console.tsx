"use client";

import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { AppealResolutionForm } from "@/components/admin/appeal-resolution-form";
import { ModerationActionForm } from "@/components/admin/moderation-action-form";
import {
  enableAdminMfa,
  getAdminMfaStatus,
  listAdminAppeals,
  listAdminAuditLogs,
  listAdminDeletionRequests,
  listAdminReports,
  listAdminSupportCases,
  resolveSupportCase,
  setupAdminMfa,
  verifyAdminMfa,
  type AdminAppeal,
  type AdminAuditLog,
  type AdminDeletionRequest,
  type AdminMfaStatus,
  type AdminReport,
  type AdminSupportCase,
  type MfaSetup,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { REPORT_REASON_LABELS } from "@/lib/api/safety";
import { restoreSession, type UserProfile } from "@/lib/auth/session";
import { SUPPORT_CASE_LABELS } from "@/lib/gifts/labels";

type PageState = "loading" | "guest" | "denied" | "ready" | "error";
type AdminTab = "reports" | "support" | "appeals" | "deletion" | "audit";

type AdminData = {
  reports: AdminReport[];
  supportCases: AdminSupportCase[];
  appeals: AdminAppeal[];
  deletionRequests: AdminDeletionRequest[];
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
  const [resolutionDrafts, setResolutionDrafts] = useState<Record<string, string>>({});

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
    const [reports, supportCases, appeals, deletionRequests, auditLogs] = await Promise.all([
      listAdminReports(token),
      listAdminSupportCases(token),
      listAdminAppeals(token),
      listAdminDeletionRequests(token),
      listAdminAuditLogs(token),
    ]);
    setData({ reports, supportCases, appeals, deletionRequests, auditLogs });
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

  async function handleResolve(caseId: string) {
    if (!mfaToken) {
      return;
    }
    const note = (resolutionDrafts[caseId] ?? "").trim();
    if (note.length < 5) {
      setError("Resolution note must be at least 5 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await resolveSupportCase(mfaToken, caseId, note);
      setData((current) =>
        current
          ? {
              ...current,
              supportCases: current.supportCases.map((item) =>
                item.id === updated.id ? updated : item,
              ),
            }
          : current,
      );
      setResolutionDrafts((current) => ({ ...current, [caseId]: "" }));
      const auditLogs = await listAdminAuditLogs(mfaToken);
      setData((current) => (current ? { ...current, auditLogs } : current));
    } catch (resolveError) {
      if (isMfaError(resolveError)) {
        setMfaToken(null);
      }
      setError(errorMessage(resolveError));
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") {
    return (
      <section
        aria-busy="true"
        aria-live="polite"
        className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-kindly-border"
      >
        <p className="text-sm text-kindly-muted">Checking admin access…</p>
      </section>
    );
  }

  if (state === "guest") {
    return (
      <section className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-kindly-border sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Admin sign in</h1>
        <p className="mt-3 text-sm text-kindly-muted">
          Sign in with an authorized moderator or administrator account.
        </p>
        <Link
          href="/sign-in"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-kindly-accent px-5 py-3 text-sm font-semibold text-white hover:bg-orange-800"
        >
          Sign in
        </Link>
      </section>
    );
  }

  if (state === "denied") {
    return (
      <section className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-kindly-border sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Admin access required</h1>
        <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          This account does not have moderator or administrator access.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm font-semibold text-kindly-accent">
          Back to discovery
        </Link>
      </section>
    );
  }

  if (state === "error") {
    return (
      <section className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-kindly-border sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Admin unavailable</h1>
        <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error ?? "Could not load the admin area."}
        </p>
        <Link href="/" className="mt-6 inline-block text-sm font-semibold text-kindly-accent">
          Back to discovery
        </Link>
      </section>
    );
  }

  const unlocked = Boolean(mfaToken && data);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="rounded-2xl border border-kindly-border bg-white p-5">
        <p className="text-sm font-semibold tracking-wide text-kindly-accent uppercase">
          Protected operations
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Admin console</h1>
          <span className="rounded-full bg-kindly-accent-soft px-3 py-1 text-xs font-semibold text-kindly-accent">
            {status?.role ?? user?.role}
          </span>
        </div>
        <p className="mt-2 text-sm text-kindly-muted">
          Moderator actions require a verified authenticator session. Never share payment details,
          UTRs or moderation notes outside this console.
        </p>
        {unlocked && (
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
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {recoveryCodes.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <h2 className="text-lg font-semibold">Save your recovery codes</h2>
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

      {status && !status.mfaEnabled && !setup && (
        <section className="rounded-2xl border border-kindly-border bg-white p-5">
          <h2 className="text-lg font-semibold">Set up authenticator MFA</h2>
          <p className="mt-1 text-sm text-kindly-muted">
            Admin routes stay locked until an authenticator app is enrolled.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={handleStartSetup}
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-kindly-accent px-5 py-3 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
          >
            {busy ? "Preparing…" : "Set up authenticator"}
          </button>
        </section>
      )}

      {setup && !mfaToken && (
        <section className="rounded-2xl border border-kindly-border bg-white p-5">
          <h2 className="text-lg font-semibold">Scan and confirm</h2>
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
              <label htmlFor="mfa-enable-code" className="block text-sm font-medium">
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
                className="mt-1 min-h-11 w-full rounded-xl border border-kindly-border px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-kindly-accent px-5 py-3 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
            >
              {busy ? "Enabling…" : "Enable MFA"}
            </button>
          </form>
        </section>
      )}

      {status?.mfaEnabled && !mfaToken && (
        <section className="rounded-2xl border border-kindly-border bg-white p-5">
          <h2 className="text-lg font-semibold">Verify MFA</h2>
          <p className="mt-1 text-sm text-kindly-muted">
            Enter an authenticator code or a one-time recovery code.
          </p>
          <form onSubmit={handleVerify} className="mt-3 flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="mfa-verify-code" className="block text-sm font-medium">
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
                className="mt-1 min-h-11 w-full rounded-xl border border-kindly-border px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-kindly-accent px-5 py-3 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
            >
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
            className="flex flex-wrap gap-1 rounded-xl border border-kindly-border bg-white p-1"
          >
            {(
              [
                ["reports", `Reports (${data.reports.length})`],
                ["support", `Support cases (${data.supportCases.length})`],
                ["appeals", `Appeals (${data.appeals.length})`],
                ["deletion", `Deletion (${data.deletionRequests.length})`],
                ["audit", `Audit log (${data.auditLogs.length})`],
              ] as Array<[AdminTab, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={tab === value}
                onClick={() => setTab(value)}
                className={`min-h-11 rounded-lg px-3 py-2 text-sm font-semibold ${
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
              <h2 id="admin-reports-heading" className="text-xl font-semibold">
                Moderation queue
              </h2>
              {data.reports.length === 0 ? (
                <p className="rounded-2xl border border-kindly-border bg-white p-5 text-sm text-kindly-muted">
                  No open reports.
                </p>
              ) : (
                data.reports.map((report) => (
                  <article
                    key={report.id}
                    className="rounded-2xl border border-kindly-border bg-white p-5 text-sm"
                  >
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
            <section aria-labelledby="admin-support-heading" className="space-y-3">
              <h2 id="admin-support-heading" className="text-xl font-semibold">
                Support cases
              </h2>
              {data.supportCases.length === 0 ? (
                <p className="rounded-2xl border border-kindly-border bg-white p-5 text-sm text-kindly-muted">
                  No support cases.
                </p>
              ) : (
                data.supportCases.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-kindly-border bg-white p-5 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">
                        {SUPPORT_CASE_LABELS[item.caseType]} · ₹{item.amountInr}
                      </span>
                      <span className="rounded-full bg-kindly-accent-soft px-3 py-1 text-xs font-semibold">
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-2 text-kindly-muted">
                      Gift {item.giftStatus} · wish {item.wishStatus} · payment{" "}
                      {item.paymentRefCode}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap">{item.description}</p>
                    <dl className="mt-3 grid gap-1 text-xs text-kindly-muted sm:grid-cols-2">
                      <div>
                        Reporter: {item.reporterDisplayName ?? "—"} · Donor:{" "}
                        {item.donorDisplayName ?? "—"} · Recipient:{" "}
                        {item.recipientDisplayName ?? "—"}
                      </div>
                      <div>
                        Masked VPA: {item.recipientMaskedVpa ?? "—"} · UTR:{" "}
                        {item.utrReference ?? "—"}
                      </div>
                    </dl>
                    {item.resolutionNote ? (
                      <p className="mt-3 rounded-xl bg-green-50 p-3 text-green-900">
                        Resolution: {item.resolutionNote} ({formatDate(item.resolvedAt)})
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        <label
                          htmlFor={`resolution-${item.id}`}
                          className="block text-sm font-medium"
                        >
                          Resolution note
                        </label>
                        <textarea
                          id={`resolution-${item.id}`}
                          rows={2}
                          maxLength={1000}
                          value={resolutionDrafts[item.id] ?? ""}
                          onChange={(event) =>
                            setResolutionDrafts((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))
                          }
                          className="w-full rounded-xl border border-kindly-border px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleResolve(item.id)}
                          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-kindly-accent px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
                        >
                          {busy ? "Resolving…" : "Resolve case"}
                        </button>
                      </div>
                    )}
                  </article>
                ))
              )}
            </section>
          )}

          {tab === "appeals" && (
            <section aria-labelledby="admin-appeals-heading" className="space-y-3">
              <h2 id="admin-appeals-heading" className="text-xl font-semibold">
                Appeals queue
              </h2>
              {data.appeals.length === 0 ? (
                <p className="rounded-2xl border border-kindly-border bg-white p-5 text-sm text-kindly-muted">
                  No open appeals.
                </p>
              ) : (
                data.appeals.map((appeal) => (
                  <article
                    key={appeal.id}
                    className="rounded-2xl border border-kindly-border bg-white p-5 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">
                        {appeal.userDisplayName ?? "Unknown user"} · {appeal.action}
                      </span>
                      <span className="rounded-full bg-kindly-accent-soft px-3 py-1 text-xs font-semibold">
                        {appeal.status}
                      </span>
                    </div>
                    <p className="mt-2 text-kindly-muted">
                      Original reason: {appeal.actionReason} · {formatDate(appeal.createdAt)}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap">{appeal.reason}</p>
                    <p className="mt-2 text-xs text-kindly-muted">
                      Appeal {appeal.id.slice(0, 8)} · action {appeal.actionId.slice(0, 8)}
                    </p>
                    {appeal.status === "OPEN" || appeal.status === "UNDER_REVIEW" ? (
                      <AppealResolutionForm
                        mfaToken={mfaToken ?? ""}
                        appealId={appeal.id}
                        onResolved={async () => {
                          if (mfaToken) {
                            await loadData(mfaToken);
                          }
                        }}
                      />
                    ) : (
                      appeal.resolutionNote && (
                        <p className="mt-3 rounded-xl bg-green-50 p-3 text-green-900">
                          Resolution: {appeal.resolutionNote} ({formatDate(appeal.resolvedAt)})
                        </p>
                      )
                    )}
                  </article>
                ))
              )}
            </section>
          )}

          {tab === "deletion" && (
            <section aria-labelledby="admin-deletion-heading" className="space-y-3">
              <h2 id="admin-deletion-heading" className="text-xl font-semibold">
                Account deletion requests
              </h2>
              <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Requests are recorded only. Do not delete or anonymise financial/audit records until
                counsel-approved retention is in place.
              </p>
              {data.deletionRequests.length === 0 ? (
                <p className="rounded-2xl border border-kindly-border bg-white p-5 text-sm text-kindly-muted">
                  No open deletion requests.
                </p>
              ) : (
                data.deletionRequests.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-kindly-border bg-white p-5 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">
                        {item.userDisplayName ?? "Unknown user"} · {item.userStatus}
                      </span>
                      <span className="rounded-full bg-kindly-accent-soft px-3 py-1 text-xs font-semibold">
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-2 text-kindly-muted">
                      Requested {formatDate(item.requestedAt)}
                      {item.cancelledAt ? ` · cancelled ${formatDate(item.cancelledAt)}` : ""}
                    </p>
                    {item.reason && <p className="mt-2">{item.reason}</p>}
                  </article>
                ))
              )}
            </section>
          )}

          {tab === "audit" && (
            <section aria-labelledby="admin-audit-heading" className="space-y-3">
              <h2 id="admin-audit-heading" className="text-xl font-semibold">
                Append-only audit log
              </h2>
              {data.auditLogs.length === 0 ? (
                <p className="rounded-2xl border border-kindly-border bg-white p-5 text-sm text-kindly-muted">
                  No audit events.
                </p>
              ) : (
                <ul className="space-y-2">
                  {data.auditLogs.map((entry) => (
                    <li
                      key={entry.id}
                      className="rounded-2xl border border-kindly-border bg-white p-4 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">{entry.action}</span>
                        <span className="text-xs text-kindly-muted">
                          {formatDate(entry.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-kindly-muted">
                        {entry.actorDisplayName ?? "System"} · {entry.targetType}
                        {entry.targetId ? ` · ${entry.targetId.slice(0, 8)}` : ""}
                      </p>
                      {entry.reason && <p className="mt-2">{entry.reason}</p>}
                      <p className="mt-1 text-xs text-kindly-muted">
                        Request {entry.requestId ?? "—"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
