import { apiFetch } from "@/lib/api/client";
import type { GiftStatus } from "@/lib/api/gifts";
import type { WishStatus } from "@/lib/api/wishes";

export type AdminRole = "USER" | "MODERATOR" | "ADMIN";

export type AdminMfaStatus = {
  role: AdminRole;
  mfaEnabled: boolean;
  mfaRequired: boolean;
  recoveryCodesRemaining: number;
};

export type MfaSetup = {
  secret: string;
  otpauthUri: string;
};

export type MfaEnableResponse = {
  mfaEnabled: boolean;
  mfaToken: string;
  expiresIn: number;
  recoveryCodes: string[];
};

export type MfaVerifyResponse = {
  mfaToken: string;
  expiresIn: number;
  method: "TOTP" | "RECOVERY";
};

export type AdminReport = {
  id: string;
  targetType: "WISH" | "USER";
  targetId: string;
  reason:
    | "SPAM_BOT"
    | "HARASSMENT_ABUSE"
    | "COMMERCIAL_SOLICITATION"
    | "INAPPROPRIATE_CONTENT"
    | "IMPERSONATION"
    | "PAYMENT_MISDIRECTION"
    | "OTHER";
  status: "OPEN" | "UNDER_REVIEW" | "ACTIONED" | "DISMISSED";
  uniqueReportCount: number;
  targetDisplayName: string | null;
  targetPreview: string | null;
  targetStatus: string | null;
  createdAt: string;
};

export type AdminSupportCase = {
  id: string;
  giftId: string;
  wishId: string;
  caseType: "LATE_PAYMENT" | "DONOR_CLAIM" | "RECIPIENT_DISPUTE" | "OTHER";
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "CLOSED";
  description: string;
  reporterDisplayName: string | null;
  donorDisplayName: string | null;
  recipientDisplayName: string | null;
  amountInr: number;
  giftStatus: GiftStatus;
  wishStatus: WishStatus;
  paymentRefCode: string;
  recipientMaskedVpa: string | null;
  utrReference: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export type AdminAuditLog = {
  id: string;
  actorDisplayName: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  reason: string | null;
  requestId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

function mfaHeaders(mfaToken: string): Record<string, string> {
  return { "X-Admin-MFA": mfaToken };
}

export async function getAdminMfaStatus(): Promise<AdminMfaStatus> {
  return apiFetch<AdminMfaStatus>("/api/v1/admin/mfa/status");
}

export async function setupAdminMfa(): Promise<MfaSetup> {
  return apiFetch<MfaSetup>("/api/v1/admin/mfa/setup", { method: "POST" });
}

export async function enableAdminMfa(code: string): Promise<MfaEnableResponse> {
  return apiFetch<MfaEnableResponse>("/api/v1/admin/mfa/enable", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
}

export async function verifyAdminMfa(code: string): Promise<MfaVerifyResponse> {
  return apiFetch<MfaVerifyResponse>("/api/v1/admin/mfa/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
}

export async function listAdminReports(mfaToken: string): Promise<AdminReport[]> {
  const data = await apiFetch<{ reports: AdminReport[] }>("/api/v1/admin/reports", {
    headers: mfaHeaders(mfaToken),
  });
  return data.reports;
}

export async function listAdminSupportCases(mfaToken: string): Promise<AdminSupportCase[]> {
  const data = await apiFetch<{ cases: AdminSupportCase[] }>("/api/v1/admin/support-cases", {
    headers: mfaHeaders(mfaToken),
  });
  return data.cases;
}

export async function resolveSupportCase(
  mfaToken: string,
  caseId: string,
  resolutionNote: string,
): Promise<AdminSupportCase> {
  return apiFetch<AdminSupportCase>(`/api/v1/admin/support-cases/${caseId}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...mfaHeaders(mfaToken) },
    body: JSON.stringify({ resolutionNote }),
  });
}

export async function listAdminAuditLogs(mfaToken: string): Promise<AdminAuditLog[]> {
  const data = await apiFetch<{ logs: AdminAuditLog[] }>("/api/v1/admin/audit-logs", {
    headers: mfaHeaders(mfaToken),
  });
  return data.logs;
}
