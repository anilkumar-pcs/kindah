import { DiscoverFeed } from "@/components/discovery/discover-feed";
import { HomeHero } from "@/components/home/home-hero";

export default function HomePage() {
  return (
    <div className="space-y-9 sm:space-y-10">
      <HomeHero />
      <DiscoverFeed />
    </div>
  );
}
