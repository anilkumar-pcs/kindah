import type { Metadata } from "next";
import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Safety centre",
  description:
    "How to stay safe, protect your privacy and get help on Kindly, a pseudonymous little-gift beta.",
};

const safetyCards = [
  {
    icon: "lock" as const,
    title: "Keep private things private",
    body: "Never put a phone number, UPI ID, address, workplace, school or social handle in a wish. Kindly never asks for your UPI PIN, OTP, card details or bank password.",
  },
  {
    icon: "cup" as const,
    title: "Check before you pay",
    body: "The UPI handoff opens your own payment app. Check the recipient name shown there. Pay only the little amount you chose. Kindly does not collect or hold the money.",
  },
  {
    icon: "shield" as const,
    title: "Use report and block early",
    body: "Wish pages have report and block actions. Reports are private, and a block removes both people from each other’s discovery and interaction.",
  },
  {
    icon: "heart" as const,
    title: "Ask for help",
    body: "If a gift goes wrong, open the gift and use its support action. If moderation affects your account, use Appeals. Do not send money to resolve a support case.",
  },
];

export default function SafetyPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        eyebrow="Safety centre"
        title="Small gifts, clear boundaries"
        description="Kindly is a trust-first beta. These are the practical limits to know before you wish, pay or confirm."
        aside={
          <span className="kindly-chip">
            <Icon name="shield" className="h-3 w-3" /> No payment custody
          </span>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {safetyCards.map((card) => (
          <section key={card.title} className="kindly-card p-4 sm:p-5">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-kindly-accent-soft text-kindly-accent">
              <Icon name={card.icon} className="h-5 w-5" />
            </span>
            <h2 className="mt-3 font-display text-xl font-semibold tracking-[-0.04em]">
              {card.title}
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-kindly-muted">{card.body}</p>
          </section>
        ))}
      </div>

      <section aria-labelledby="cannot-guarantee-heading" className="kindly-card-soft p-5 sm:p-6">
        <p className="kindly-eyebrow">The honest part</p>
        <h2
          id="cannot-guarantee-heading"
          className="mt-1 font-display text-2xl font-semibold tracking-[-0.045em]"
        >
          What Kindly cannot guarantee
        </h2>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-kindly-muted">
          <li>
            We cannot verify that a donor actually paid, or that a recipient received the money.
          </li>
          <li>
            We cannot verify who owns a UPI ID, or guarantee that a wish will be fulfilled at all.
          </li>
          <li>We cannot control how a recipient uses a gift once it reaches them.</li>
          <li>We cannot mediate a bank or UPI dispute. Use your payment app and bank for those.</li>
          <li>
            Statuses are attestations from the people involved, not bank-verified proof of payment.
          </li>
        </ul>
      </section>

      <section aria-labelledby="privacy-heading" className="kindly-card p-5 sm:p-6">
        <p className="kindly-eyebrow">Privacy in practice</p>
        <h2
          id="privacy-heading"
          className="mt-1 font-display text-2xl font-semibold tracking-[-0.045em]"
        >
          What other people can see
        </h2>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-2xl border border-kindly-border bg-kindly-cream/60 p-4">
            <h3 className="font-bold">Public</h3>
            <ul className="mt-2 space-y-1 text-kindly-muted">
              <li>Your pseudonym and avatar symbol</li>
              <li>Your wish message, mood, optional city and suggested amount</li>
              <li>Aggregate community activity</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-kindly-border bg-kindly-cream/60 p-4">
            <h3 className="font-bold">Private by design</h3>
            <ul className="mt-2 space-y-1 text-kindly-muted">
              <li>Your phone number and raw UPI ID</li>
              <li>Payment references and attestation details</li>
              <li>Support messages, moderation notes and security logs</li>
            </ul>
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-kindly-muted">
          Read the{" "}
          <Link href="/legal#privacy" className="font-semibold text-kindly-accent underline">
            draft privacy outline
          </Link>{" "}
          for the fuller picture. It still needs legal review.
        </p>
      </section>

      <section className="flex flex-wrap gap-2">
        <Link href="/" className="kindly-btn-primary">
          Back to discovery
        </Link>
        <Link href="/appeals" className="kindly-btn-secondary">
          Appeals
        </Link>
        <Link href="/legal#terms" className="kindly-btn-quiet">
          Draft terms
        </Link>
      </section>
    </div>
  );
}
