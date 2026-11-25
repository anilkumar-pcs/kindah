import type { Metadata } from "next";

import { DiscoverFeed } from "@/components/discovery/discover-feed";

export const metadata: Metadata = {
  title: "Discover little wishes",
  description:
    "Browse pseudonymous little wishes. Guests can look around; signing in is required to take part.",
};

export default function DiscoverPage() {
  return <DiscoverFeed />;
}
