import type { Metadata } from "next";
import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "About Kindly",
  description: "Kindly is a small, pseudonymous micro-gifting beta for everyday kindness.",
};

const beliefs = [
  {
    icon: "cup" as const,
    title: "Small is enough",
    body: "A chai, a snack, a tiny treat. Kindness does not need a campaign or a grand gesture.",
  },
  {
    icon: "shield" as const,
    title: "Dignity first",
    body: "Wishes are pseudonymous. A recipient never has to perform hardship to be worthy of care.",
  },
  {
    icon: "plant" as const,
    title: "No pressure",
    body: "One wish at a time, one donor per wish, ₹10–₹100. No targets, pools, ads or cash-value karma.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        eyebrow="About Kindly"
        title="Small kindness, without the noise"
        description="Kindly is a small beta for spontaneous little gifts between strangers. Not a campaign, not a crowdfunding page, not a wallet."
        aside={
          <span className="kindly-chip">
            <Icon name="heart" className="h-3 w-3" /> Little things add up
          </span>
        }
      />

      <section className="kindly-card relative overflow-hidden p-5 sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-10 -right-8 h-40 w-40 rounded-full bg-kindly-marigold/30 blur-2xl"
        />
        <p className="relative font-hand text-2xl leading-8 text-kindly-coral sm:text-3xl">
          “I just wanted a chai. Someone kind made my day.”
        </p>
        <p className="relative mt-3 text-sm leading-6 text-kindly-muted">
          That is the whole idea. Kindly makes one small wish visible to one kind stranger, then
          gets out of the way. The money goes directly over UPI between the two people.
        </p>
      </section>

      <section aria-labelledby="beliefs-heading">
        <p className="kindly-eyebrow">What we believe</p>
        <h2
          id="beliefs-heading"
          className="mt-1 font-display text-2xl font-semibold tracking-[-0.045em]"
        >
          Kindness should feel light
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {beliefs.map((belief) => (
            <article key={belief.title} className="kindly-card p-4">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-kindly-accent-soft text-kindly-accent">
                <Icon name={belief.icon} className="h-5 w-5" />
              </span>
              <h3 className="mt-3 font-display text-xl font-semibold tracking-[-0.04em]">
                {belief.title}
              </h3>
              <p className="mt-1.5 text-sm leading-6 text-kindly-muted">{belief.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="how-heading" className="kindly-card p-5 sm:p-6">
        <p className="kindly-eyebrow">How it works</p>
        <h2
          id="how-heading"
          className="mt-1 font-display text-2xl font-semibold tracking-[-0.045em]"
        >
          One wish. One donor. Direct UPI.
        </h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            ["01", "Save a private UPI ID", "The raw address is not shown publicly."],
            ["02", "Share one small wish", "A pseudonym, a mood and ₹10–₹100."],
            ["03", "A donor opens the handoff", "They pay directly in their own UPI app."],
            [
              "04",
              "The recipient confirms",
              "Attestations close the loop; Kindly never holds the money.",
            ],
          ].map(([number, title, body]) => (
            <li key={number} className="rounded-2xl bg-kindly-accent-soft/60 p-4">
              <span className="font-display text-sm font-bold text-kindly-coral">{number}</span>
              <h3 className="mt-1 font-display text-lg font-semibold tracking-[-0.035em]">
                {title}
              </h3>
              <p className="mt-1 text-sm leading-6 text-kindly-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="not-heading" className="kindly-card-soft p-5 sm:p-6">
        <p className="kindly-eyebrow">What we hold back</p>
        <h2
          id="not-heading"
          className="mt-1 font-display text-2xl font-semibold tracking-[-0.045em]"
        >
          No campaigns. No targets. No theatre.
        </h2>
        <ul className="mt-3 grid gap-2 text-sm leading-6 text-kindly-muted sm:grid-cols-2">
          <li>No charity or crowdfunding claims.</li>
          <li>No wallets, escrow, commission or ads.</li>
          <li>No pooling or stretch goals.</li>
          <li>No cash-redeemable karma or public donor leaderboard.</li>
          <li>No public phone numbers, raw UPI IDs or payment proofs.</li>
          <li>No individual donor-to-recipient money-flow map.</li>
        </ul>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-[2rem] bg-kindly-accent p-5 text-kindly-cream sm:p-6">
        <div>
          <p className="font-display text-2xl font-semibold tracking-[-0.045em]">
            Find a little wish to brighten.
          </p>
          <p className="mt-1 text-sm text-kindly-cream/75">
            Or share one of your own. Keep it small, keep it kind.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-full bg-kindly-cream px-4 text-sm font-bold text-kindly-ink"
          >
            Discover wishes
          </Link>
          <Link
            href="/me#wish"
            className="inline-flex min-h-11 items-center rounded-full border border-kindly-cream/30 px-4 text-sm font-bold text-kindly-cream"
          >
            My Space
          </Link>
        </div>
      </section>

      <p className="text-xs leading-5 text-kindly-muted">
        Kindly is in beta. Read the{" "}
        <Link href="/safety" className="font-semibold text-kindly-accent underline">
          safety centre
        </Link>{" "}
        and the{" "}
        <Link href="/legal" className="font-semibold text-kindly-accent underline">
          draft legal declarations
        </Link>
        .
      </p>
    </div>
  );
}
