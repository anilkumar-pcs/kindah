import Link from "next/link";

import { Icon, type IconName } from "@/components/ui/icon";

const steps: Array<{ number: string; title: string; body: string; icon: IconName }> = [
  {
    number: "01",
    title: "One small wish",
    body: "A pseudonym, a mood, and a little thing that would make the day lighter.",
    icon: "sun",
  },
  {
    number: "02",
    title: "One kind donor",
    body: "A stranger opens a direct UPI handoff and sends ₹10–₹100 from their own app.",
    icon: "heart",
  },
  {
    number: "03",
    title: "One honest confirmation",
    body: "The recipient confirms what arrived. No campaigns, targets or proof-of-use theatre.",
    icon: "plant",
  },
];

const promises = [
  "No fees or commission",
  "No wallet or escrow",
  "No public phone or raw UPI ID",
  "No cash-redeemable karma",
];

export function HomeHowItWorks() {
  return (
    <section aria-labelledby="home-how-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="kindly-eyebrow">The little loop</p>
          <h2
            id="home-how-heading"
            className="mt-1 font-display text-3xl font-semibold tracking-[-0.05em] sm:text-4xl"
          >
            Kindness, kept simple
          </h2>
        </div>
        <Link href="/about" className="kindly-btn-quiet !min-h-9 !px-2 !text-xs">
          Why Kindly exists <Icon name="arrow-right" className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {steps.map((step) => (
          <article key={step.number} className="kindly-card relative overflow-hidden p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="font-display text-sm font-bold text-kindly-coral">
                {step.number}
              </span>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-kindly-accent-soft text-kindly-accent">
                <Icon name={step.icon} className="h-4 w-4" />
              </span>
            </div>
            <h3 className="mt-3 font-display text-xl font-semibold tracking-[-0.04em]">
              {step.title}
            </h3>
            <p className="mt-1.5 text-sm leading-6 text-kindly-muted">{step.body}</p>
          </article>
        ))}
      </div>

      <div className="kindly-card-soft flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
        <div>
          <p className="font-display text-xl font-semibold tracking-[-0.04em]">
            Warm, but clear-eyed.
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-kindly-muted">
            {promises.map((promise) => (
              <li key={promise} className="inline-flex items-center gap-1.5">
                <Icon name="shield" className="h-3 w-3 text-kindly-accent" />
                {promise}
              </li>
            ))}
          </ul>
        </div>
        <Link href="/safety" className="kindly-btn-secondary !min-h-9">
          Safety centre
        </Link>
      </div>
    </section>
  );
}
