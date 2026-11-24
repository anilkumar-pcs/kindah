import { HomeActions } from "@/components/home-actions";
import { HomeArt } from "@/components/home/home-art";
import { Icon } from "@/components/ui/icon";

export function HomeHero() {
  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-kindly-accent-soft px-5 py-8 sm:px-9 sm:py-10 lg:px-12 lg:py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-kindly-marigold/30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-kindly-blush/50 blur-3xl"
      />
      <div className="relative grid gap-8 lg:grid-cols-[1.12fr_0.88fr] lg:items-center lg:gap-10">
        <div>
          <p className="text-[10px] font-extrabold tracking-[0.18em] text-kindly-accent uppercase">
            Bengaluru · just because
          </p>
          <h1 className="mt-3 max-w-[680px] font-display text-[2.55rem] leading-[0.92] font-semibold tracking-[-0.06em] text-balance text-kindly-ink sm:text-6xl lg:text-[3.7rem] xl:text-[4rem]">
            A little something for someone&rsquo;s day.
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-6 text-kindly-muted sm:text-base sm:leading-7">
            Small gifts, zero pressure. Send ₹10&ndash;₹100 directly over UPI. No campaigns, no
            proof-of-use, no spotlight required.
          </p>
          <HomeActions />
          <div className="mt-5 flex items-start gap-2 text-[11px] leading-5 font-semibold text-kindly-accent">
            <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Direct UPI · no fees · Kindly never holds your money</span>
          </div>
        </div>
        <HomeArt />
      </div>
    </section>
  );
}
