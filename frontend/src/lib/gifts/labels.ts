import type { GiftStatus, SupportCaseType } from "@/lib/api/gifts";

export const GIFT_STATUS_LABELS: Record<GiftStatus, string> = {
  CREATED: "Preparing payment handoff",
  HANDOFF_ISSUED: "Payment handoff ready",
  DONOR_PENDING: "Payment still processing",
  DONOR_CLAIMED_PAID: "Awaiting recipient confirmation",
  RECIPIENT_CONFIRMED: "Recipient confirmed",
  UNVERIFIED: "Unverified",
  DISPUTED: "Disputed",
  FAILED: "Not paid",
  ABANDONED: "Reservation expired",
  CANCELLED: "Cancelled",
};

export function giftStatusLabel(status: GiftStatus): string {
  return GIFT_STATUS_LABELS[status];
}

export function giftStatusTone(status: GiftStatus): string {
  if (status === "RECIPIENT_CONFIRMED") {
    return "bg-green-50 text-green-800 ring-green-200";
  }
  if (status === "DISPUTED" || status === "UNVERIFIED" || status === "FAILED") {
    return "bg-amber-50 text-amber-900 ring-amber-200";
  }
  if (status === "ABANDONED" || status === "CANCELLED") {
    return "bg-stone-100 text-stone-700 ring-stone-200";
  }
  return "bg-kindly-accent-soft text-kindly-accent ring-orange-200";
}

export const SUPPORT_CASE_LABELS: Record<SupportCaseType, string> = {
  LATE_PAYMENT: "Late payment",
  DONOR_CLAIM: "Donor payment claim",
  RECIPIENT_DISPUTE: "I did not receive it",
  OTHER: "Something else",
};
