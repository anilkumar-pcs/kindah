import { apiFetch } from "@/lib/api/client";

export type DeletionRequest = {
  id: string;
  status: "REQUESTED" | "CANCELLED" | "COMPLETED";
  reason: string | null;
  requestedAt: string;
  cancelledAt: string | null;
};

export async function getMyDeletionRequest(): Promise<DeletionRequest> {
  return apiFetch<DeletionRequest>("/api/v1/me/deletion-request");
}

export async function requestDeletion(reason?: string): Promise<DeletionRequest> {
  return apiFetch<DeletionRequest>("/api/v1/me/deletion-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reason ? { reason } : {}),
  });
}

export async function cancelDeletion(): Promise<DeletionRequest> {
  return apiFetch<DeletionRequest>("/api/v1/me/deletion-request", {
    method: "DELETE",
  });
}
