import { apiFetch } from "@/lib/api/client";

export type WishMood = "CHAI_SNACK" | "JUST_BECAUSE" | "LONG_DAY" | "TINY_TREAT";

export type WishStatus =
  | "OPEN"
  | "LOCKED"
  | "PAYMENT_CLAIMED"
  | "GRANTED"
  | "UNVERIFIED"
  | "DISPUTED"
  | "EXPIRED"
  | "UNDER_REVIEW"
  | "REMOVED";

export type Wish = {
  id: string;
  message: string;
  mood: WishMood;
  suggestedAmountInr: number | null;
  city: string | null;
  status: WishStatus;
  expiresAt: string;
  cooldownUntil: string | null;
  closedReason: string | null;
  createdAt: string;
};

export type WishCreateInput = {
  message: string;
  mood: WishMood;
  suggestedAmountInr?: number;
  city?: string;
};

export async function createWish(input: WishCreateInput): Promise<Wish> {
  return apiFetch<Wish>("/api/v1/wishes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function listMyWishes(): Promise<Wish[]> {
  const data = await apiFetch<{ wishes: Wish[] }>("/api/v1/me/wishes");
  return data.wishes;
}

export async function withdrawWish(wishId: string): Promise<Wish> {
  return apiFetch<Wish>(`/api/v1/wishes/${wishId}`, {
    method: "DELETE",
  });
}
