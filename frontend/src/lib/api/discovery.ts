import { apiFetch } from "@/lib/api/client";
import type { WishMood } from "@/lib/api/wishes";

export type PublicWish = {
  id: string;
  displayName: string;
  avatar: string;
  city: string | null;
  createdAt: string;
  mood: WishMood;
  message: string;
  suggestedAmountInr: number | null;
};

export type FeedPage = {
  wishes: PublicWish[];
  nextCursor: string | null;
  seed: string | null;
};

export type FeedParams = {
  sort: "fresh" | "random";
  city?: string;
  cursor?: string;
  seed?: string;
  limit?: number;
};

export async function listPublicWishes(params: FeedParams): Promise<FeedPage> {
  const query = new URLSearchParams();
  query.set("sort", params.sort);
  query.set("limit", String(params.limit ?? 6));
  if (params.city) {
    query.set("city", params.city);
  }
  if (params.cursor) {
    query.set("cursor", params.cursor);
  }
  if (params.seed) {
    query.set("seed", params.seed);
  }
  return apiFetch<FeedPage>(`/api/v1/wishes?${query.toString()}`);
}

export async function getPublicWish(wishId: string): Promise<PublicWish> {
  return apiFetch<PublicWish>(`/api/v1/wishes/${wishId}`);
}

export async function selectWish(wishId: string): Promise<PublicWish> {
  return apiFetch<PublicWish>(`/api/v1/wishes/${wishId}/select`, {
    method: "POST",
  });
}
