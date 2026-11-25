import { apiFetch } from "@/lib/api/client";
import type { GiftStatus } from "@/lib/api/gifts";
import type { WishMood, WishStatus } from "@/lib/api/wishes";

export type AdminRole = "USER" | "MODERATOR" | "ADMIN";

export type BadgeDefinition = {
  code: string;
  label: string;
  ruleType: "CONFIRMED_SENT" | "THANKS_RECEIVED" | "STREAK_DAYS";
  threshold: number;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminUser = {
  id: string;
  displayName: string | null;
  role: "USER" | "MODERATOR" | "ADMIN";
  status: string;
  createdAt: string;
};

export type AdminUserPage = {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminWish = {
  id: string;
  displayName: string | null;
  message: string;
  mood: WishMood;
  suggestedAmountInr: number | null;
  city: string | null;
  status: WishStatus;
  closedReason: string | null;
  createdAt: string;
  expiresAt: string;
};

export type AdminWishPage = {
  wishes: AdminWish[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminPageParams = {
  query?: string;
  status?: string;
  page?: number;
  pageSize?: number;
};

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

export type ModerationActionResponse = {
  id: string;
  targetType: "USER" | "WISH";
  targetId: string;
  action: string;
  reason: string;
  moderatorDisplayName: string | null;
  createdAt: string;
};

export type AdminDeletionRequest = {
  id: string;
  userDisplayName: string | null;
  userStatus: string;
  status: "REQUESTED" | "CANCELLED" | "COMPLETED";
  reason: string | null;
  requestedAt: string;
  cancelledAt: string | null;
};

export type AdminAppeal = {
  id: string;
  actionId: string;
  userDisplayName: string | null;
  action: string;
  actionReason: string;
  targetType: string;
  targetId: string;
  status: "OPEN" | "UNDER_REVIEW" | "ACCEPTED" | "REJECTED";
  reason: string;
  resolutionNote: string | null;
  resolvedByDisplayName: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

export type OutboxDeadLetter = {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  attempts: number;
  deadLetterReason: string | null;
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

export async function moderateUser(
  mfaToken: string,
  userId: string,
  input: { action: "WARN" | "RESTRICT" | "SUSPEND" | "BAN" | "REACTIVATE"; reason: string },
): Promise<ModerationActionResponse> {
  return apiFetch<ModerationActionResponse>(`/api/v1/admin/users/${userId}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...mfaHeaders(mfaToken) },
    body: JSON.stringify(input),
  });
}

export async function moderateWish(
  mfaToken: string,
  wishId: string,
  input: { action: "HIDE" | "RESTORE" | "REMOVE"; reason: string },
): Promise<ModerationActionResponse> {
  return apiFetch<ModerationActionResponse>(`/api/v1/admin/wishes/${wishId}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...mfaHeaders(mfaToken) },
    body: JSON.stringify(input),
  });
}

export async function listAdminBadges(mfaToken: string): Promise<BadgeDefinition[]> {
  const data = await apiFetch<{ badges: BadgeDefinition[] }>("/api/v1/admin/badges", {
    headers: mfaHeaders(mfaToken),
  });
  return data.badges;
}

export async function createAdminBadge(
  mfaToken: string,
  input: Omit<BadgeDefinition, "createdAt" | "updatedAt" | "active">,
): Promise<BadgeDefinition> {
  return apiFetch<BadgeDefinition>("/api/v1/admin/badges", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...mfaHeaders(mfaToken) },
    body: JSON.stringify(input),
  });
}

export async function updateAdminBadge(
  mfaToken: string,
  code: string,
  input: Partial<
    Pick<BadgeDefinition, "label" | "ruleType" | "threshold" | "active" | "sortOrder">
  >,
): Promise<BadgeDefinition> {
  return apiFetch<BadgeDefinition>(`/api/v1/admin/badges/${code}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...mfaHeaders(mfaToken) },
    body: JSON.stringify(input),
  });
}

export async function deactivateAdminBadge(
  mfaToken: string,
  code: string,
): Promise<BadgeDefinition> {
  return apiFetch<BadgeDefinition>(`/api/v1/admin/badges/${code}`, {
    method: "DELETE",
    headers: mfaHeaders(mfaToken),
  });
}

export async function listAdminUsers(mfaToken: string, query?: string): Promise<AdminUser[]> {
  const suffix = query ? `?query=${encodeURIComponent(query)}` : "";
  const data = await apiFetch<{ users: AdminUser[] }>(`/api/v1/admin/users${suffix}`, {
    headers: mfaHeaders(mfaToken),
  });
  return data.users;
}

export async function listAdminUsersPage(
  mfaToken: string,
  params: AdminPageParams = {},
): Promise<AdminUserPage> {
  const query = new URLSearchParams();
  if (params.query?.trim()) {
    query.set("query", params.query.trim());
  }
  if (params.status) {
    query.set("status", params.status);
  }
  query.set("page", String(params.page ?? 1));
  query.set("page_size", String(params.pageSize ?? 20));
  return apiFetch<AdminUserPage>(`/api/v1/admin/users?${query.toString()}`, {
    headers: mfaHeaders(mfaToken),
  });
}

export async function listAdminWishes(
  mfaToken: string,
  params: AdminPageParams = {},
): Promise<AdminWishPage> {
  const query = new URLSearchParams();
  if (params.query?.trim()) {
    query.set("query", params.query.trim());
  }
  if (params.status) {
    query.set("status", params.status);
  }
  query.set("page", String(params.page ?? 1));
  query.set("page_size", String(params.pageSize ?? 20));
  return apiFetch<AdminWishPage>(`/api/v1/admin/wishes?${query.toString()}`, {
    headers: mfaHeaders(mfaToken),
  });
}

export async function updateUserRole(
  mfaToken: string,
  userId: string,
  role: "USER" | "MODERATOR" | "ADMIN",
  reason: string,
): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/api/v1/admin/users/${userId}/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...mfaHeaders(mfaToken) },
    body: JSON.stringify({ role, reason }),
  });
}

export async function listAdminOutboxDeadLetters(mfaToken: string): Promise<OutboxDeadLetter[]> {
  const data = await apiFetch<{ deadLetters: OutboxDeadLetter[] }>(
    "/api/v1/admin/outbox/dead-letters",
    { headers: mfaHeaders(mfaToken) },
  );
  return data.deadLetters;
}

export async function listAdminDeletionRequests(mfaToken: string): Promise<AdminDeletionRequest[]> {
  const data = await apiFetch<{ requests: AdminDeletionRequest[] }>(
    "/api/v1/admin/deletion-requests",
    { headers: mfaHeaders(mfaToken) },
  );
  return data.requests;
}

export async function listAdminAppeals(mfaToken: string): Promise<AdminAppeal[]> {
  const data = await apiFetch<{ appeals: AdminAppeal[] }>("/api/v1/admin/appeals", {
    headers: mfaHeaders(mfaToken),
  });
  return data.appeals;
}

export async function resolveAppeal(
  mfaToken: string,
  appealId: string,
  input: { outcome: "ACCEPTED" | "REJECTED"; resolutionNote: string },
): Promise<AdminAppeal> {
  return apiFetch<AdminAppeal>(`/api/v1/admin/appeals/${appealId}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...mfaHeaders(mfaToken) },
    body: JSON.stringify(input),
  });
}

export async function listAdminAuditLogs(mfaToken: string): Promise<AdminAuditLog[]> {
  const data = await apiFetch<{ logs: AdminAuditLog[] }>("/api/v1/admin/audit-logs", {
    headers: mfaHeaders(mfaToken),
  });
  return data.logs;
}
