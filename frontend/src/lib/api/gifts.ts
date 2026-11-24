import { apiFetch } from "@/lib/api/client";
import type { WishStatus } from "@/lib/api/wishes";

export type GiftStatus =
  | "CREATED"
  | "HANDOFF_ISSUED"
  | "DONOR_PENDING"
  | "DONOR_CLAIMED_PAID"
  | "RECIPIENT_CONFIRMED"
  | "UNVERIFIED"
  | "DISPUTED"
  | "FAILED"
  | "ABANDONED"
  | "CANCELLED";

export type GiftViewerRole = "DONOR" | "RECIPIENT";

export type Gift = {
  giftId: string;
  wishId: string;
  giftStatus: GiftStatus;
  wishStatus: WishStatus;
  viewerRole: GiftViewerRole;
  amountInr: number;
  paymentRefCode: string;
  upiIntentUri: string | null;
  qrPayload: string | null;
  reservationExpiresAt: string | null;
  recipientResponseDeadline: string | null;
  recipientDisplayName: string | null;
  reaction: string | null;
  thankYouMessage: string | null;
  createdAt: string;
};

export type GiftCreateInput = {
  wishId: string;
  amountInr: number;
  cheerNote?: string;
};

export type DonorOutcome = "PAID" | "STILL_PROCESSING" | "FAILED";
export type RecipientOutcome = "RECEIVED" | "NOT_RECEIVED";
export type Reaction = "HEART" | "PRAY" | "SMILE";

export type SupportCaseType = "LATE_PAYMENT" | "DONOR_CLAIM" | "RECIPIENT_DISPUTE" | "OTHER";
export type SupportCase = {
  id: string;
  caseType: SupportCaseType;
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "CLOSED";
  createdAt: string;
  updatedAt: string;
};

export function newIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `kindly-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function idempotencyHeaders(key: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Idempotency-Key": key,
  };
}

export async function createGift(input: GiftCreateInput, idempotencyKey: string): Promise<Gift> {
  return apiFetch<Gift>("/api/v1/gifts", {
    method: "POST",
    headers: idempotencyHeaders(idempotencyKey),
    body: JSON.stringify({
      wishId: input.wishId,
      amountInr: input.amountInr,
      ...(input.cheerNote ? { cheerNote: input.cheerNote } : {}),
    }),
  });
}

export type ShareCard = {
  giftId: string;
  amountInr: number;
  wishMessage: string;
  recipientDisplayName: string | null;
  reaction: string | null;
  thankYouMessage: string | null;
  createdAt: string;
  shareText: string;
};

export async function getGift(giftId: string): Promise<Gift> {
  return apiFetch<Gift>(`/api/v1/gifts/${giftId}`);
}

export async function getShareCard(giftId: string): Promise<ShareCard> {
  return apiFetch<ShareCard>(`/api/v1/gifts/${giftId}/share-card`);
}

export async function listMyGifts(): Promise<Gift[]> {
  const data = await apiFetch<{ gifts: Gift[] }>("/api/v1/me/gifts");
  return data.gifts;
}

export async function reportDonorOutcome(
  giftId: string,
  outcome: DonorOutcome,
  idempotencyKey: string,
  utrReference?: string,
): Promise<Gift> {
  return apiFetch<Gift>(`/api/v1/gifts/${giftId}/donor-outcome`, {
    method: "POST",
    headers: idempotencyHeaders(idempotencyKey),
    body: JSON.stringify({
      outcome,
      ...(utrReference ? { utrReference } : {}),
    }),
  });
}

export async function confirmRecipientOutcome(
  giftId: string,
  input: {
    outcome: RecipientOutcome;
    reaction?: Reaction;
    message?: string;
  },
  idempotencyKey: string,
): Promise<Gift> {
  return apiFetch<Gift>(`/api/v1/gifts/${giftId}/recipient-confirmation`, {
    method: "POST",
    headers: idempotencyHeaders(idempotencyKey),
    body: JSON.stringify({
      outcome: input.outcome,
      ...(input.reaction ? { reaction: input.reaction } : {}),
      ...(input.message ? { message: input.message } : {}),
    }),
  });
}

export async function createSupportCase(
  giftId: string,
  input: { caseType: SupportCaseType; description: string },
): Promise<SupportCase> {
  return apiFetch<SupportCase>(`/api/v1/gifts/${giftId}/support-cases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caseType: input.caseType,
      description: input.description,
    }),
  });
}
