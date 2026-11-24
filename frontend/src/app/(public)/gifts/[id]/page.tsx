"use client";

import { useParams } from "next/navigation";

import { GiftDetail } from "@/components/gifts/gift-detail";

export default function GiftDetailPage() {
  const params = useParams<{ id: string }>();
  return <GiftDetail giftId={params.id} />;
}
