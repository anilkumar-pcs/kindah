"use client";

import { useParams } from "next/navigation";

import { WishDetail } from "@/components/discovery/wish-detail";

export default function WishDetailPage() {
  const params = useParams<{ id: string }>();
  return <WishDetail wishId={params.id} />;
}
