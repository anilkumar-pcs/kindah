import { apiFetch } from "@/lib/api/client";

export type ReportReason =
  | "SPAM_BOT"
  | "HARASSMENT_ABUSE"
  | "COMMERCIAL_SOLICITATION"
  | "INAPPROPRIATE_CONTENT"
  | "IMPERSONATION"
  | "PAYMENT_MISDIRECTION"
  | "OTHER";

export type ModerationReport = {
  id: string;
  targetType: "WISH" | "USER";
  targetId: string;
  reason: ReportReason;
  status: "OPEN" | "UNDER_REVIEW" | "ACTIONED" | "DISMISSED";
  createdAt: string;
};

export type BlockedUser = {
  blockedUserId: string;
  displayName: string | null;
  createdAt: string;
};

export async function reportWish(wishId: string, reason: ReportReason): Promise<ModerationReport> {
  return apiFetch<ModerationReport>(`/api/v1/wishes/${wishId}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}

export async function blockWishOwner(wishId: string): Promise<BlockedUser> {
  return apiFetch<BlockedUser>(`/api/v1/wishes/${wishId}/block-owner`, {
    method: "POST",
  });
}

export async function unblockWishOwner(wishId: string): Promise<void> {
  await apiFetch<void>(`/api/v1/wishes/${wishId}/block-owner`, {
    method: "DELETE",
  });
}

export async function listBlocks(): Promise<BlockedUser[]> {
  const data = await apiFetch<{ blockedUsers: BlockedUser[] }>("/api/v1/me/blocks");
  return data.blockedUsers;
}

export async function unblockUser(userId: string): Promise<void> {
  await apiFetch<void>(`/api/v1/users/${userId}/block`, {
    method: "DELETE",
  });
}

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  SPAM_BOT: "Spam or bot",
  HARASSMENT_ABUSE: "Harassment or abuse",
  COMMERCIAL_SOLICITATION: "Commercial solicitation",
  INAPPROPRIATE_CONTENT: "Inappropriate content",
  IMPERSONATION: "Impersonation",
  PAYMENT_MISDIRECTION: "Payment misdirection",
  OTHER: "Something else",
};
