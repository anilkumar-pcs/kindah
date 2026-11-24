import { apiFetch } from "@/lib/api/client";

export type ModerationActionSummary = {
  id: string;
  action: "WARN" | "RESTRICT" | "SUSPEND" | "BAN" | "REACTIVATE";
  reason: string;
  appealStatus: "OPEN" | "UNDER_REVIEW" | "ACCEPTED" | "REJECTED" | null;
  canAppeal: boolean;
  createdAt: string;
};

export type Appeal = {
  id: string;
  actionId: string;
  status: "OPEN" | "UNDER_REVIEW" | "ACCEPTED" | "REJECTED";
  reason: string;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

export async function listMyModerationActions(): Promise<ModerationActionSummary[]> {
  const data = await apiFetch<{ actions: ModerationActionSummary[] }>(
    "/api/v1/me/moderation-actions",
  );
  return data.actions;
}

export async function submitAppeal(actionId: string, reason: string): Promise<Appeal> {
  return apiFetch<Appeal>(`/api/v1/me/moderation-actions/${actionId}/appeals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}

export async function listMyAppeals(): Promise<Appeal[]> {
  const data = await apiFetch<{ appeals: Appeal[] }>("/api/v1/me/appeals");
  return data.appeals;
}
