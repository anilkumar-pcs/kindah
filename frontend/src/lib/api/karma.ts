import { apiFetch } from "@/lib/api/client";

export type KarmaEvent = {
  id: string;
  eventType: string;
  pointsDelta: number;
  giftId: string | null;
  createdAt: string;
};

export type KarmaBadge = {
  badgeCode: string;
  unlockedAt: string;
};

export type KarmaSummary = {
  balance: number;
  streak: number;
  events: KarmaEvent[];
  badges: KarmaBadge[];
};

export async function getKarmaSummary(): Promise<KarmaSummary> {
  return apiFetch<KarmaSummary>("/api/v1/me/karma");
}
