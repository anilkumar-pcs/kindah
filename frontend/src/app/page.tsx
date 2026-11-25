import { CityPulse } from "@/components/home/city-pulse";
import { HomeHero } from "@/components/home/home-hero";
import { HomeHowItWorks } from "@/components/home/home-how-it-works";

export default function HomePage() {
  return (
    <div className="space-y-9 sm:space-y-10">
      <HomeHero />
      <CityPulse />
      <HomeHowItWorks />
    </div>
  );
}
