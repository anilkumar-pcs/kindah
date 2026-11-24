"use client";

import { useParams } from "next/navigation";

import { GiftFlow } from "@/components/gifts/gift-flow";

export default function NewGiftPage() {
  const params = useParams<{ wishId: string }>();
  return <GiftFlow wishId={params.wishId} />;
}
