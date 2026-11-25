import type { Metadata } from "next";
import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Legal & declarations",
  description:
    "Working-draft terms, privacy outline and accessibility statement for the Kindly little-gift beta.",
  robots: { index: false, follow: true },
};

export default function LegalPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        eyebrow="Working drafts"
        title="Legal & declarations"
        description="Plain-language declarations, a draft privacy outline and a draft terms summary for the Kindly beta. These are not final legal documents."
        aside={
          <span className="kindly-chip">
            <Icon name="lock" className="h-3 w-3" /> Counsel review pending
          </span>
        }
      />

      <section className="kindly-status-error p-4 text-sm leading-6" role="note">
        <p className="font-bold">Draft notice</p>
        <p className="mt-1">
          These pages are working drafts prepared for product clarity, not legal advice. Kindly has
          not published a legal entity, registered address, grievance officer or final retention
          schedule. A qualified adviser must review and replace these drafts before public launch.
        </p>
      </section>

      <nav aria-label="On this page" className="flex flex-wrap gap-2 text-xs font-bold">
        <a href="#declarations" className="kindly-chip">
          Declarations
        </a>
        <a href="#terms" className="kindly-chip">
          Terms
        </a>
        <a href="#privacy" className="kindly-chip">
          Privacy
        </a>
        <a href="#accessibility" className="kindly-chip">
          Accessibility
        </a>
      </nav>

      <section id="declarations" className="scroll-mt-24">
        <p className="kindly-eyebrow">Plain language</p>
        <h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.045em]">
          What Kindly is — and is not
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="kindly-card p-4 text-sm leading-6">
            <p className="font-bold">Kindly is</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-kindly-muted">
              <li>A pseudonymous way to share one small wish.</li>
              <li>A direct UPI handoff between two people.</li>
              <li>A place for ₹10–₹100 gifts, one donor per wish.</li>
              <li>An 18+ beta.</li>
            </ul>
          </div>
          <div className="kindly-card p-4 text-sm leading-6">
            <p className="font-bold">Kindly is not</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-kindly-muted">
              <li>A charity, crowdfunding platform or donation intermediary.</li>
              <li>A wallet, escrow, custodian, payment processor or commission agent.</li>
              <li>A guarantee that a wish will be fulfilled or a gift will arrive.</li>
              <li>A bank-verification or dispute-resolution service.</li>
            </ul>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-kindly-muted">
          Gifts move directly over UPI. Kindly does not hold the money and cannot verify payment.
          Donor and recipient statuses are attestations. Karma and badges have no cash value and
          cannot be redeemed, transferred or pooled.
        </p>
      </section>

      <section
        id="terms"
        aria-labelledby="terms-heading"
        className="scroll-mt-24 kindly-card p-5 sm:p-6"
      >
        <p className="kindly-eyebrow">Draft terms summary</p>
        <h2
          id="terms-heading"
          className="mt-1 font-display text-2xl font-semibold tracking-[-0.045em]"
        >
          Terms of use
        </h2>
        <div className="mt-3 space-y-3 text-sm leading-6 text-kindly-muted">
          <p>
            <strong className="text-kindly-ink">Eligibility.</strong> You must be 18 or older and
            able to enter a binding agreement. One account per person; do not impersonate anyone or
            create accounts to evade moderation.
          </p>
          <p>
            <strong className="text-kindly-ink">One wish at a time.</strong> You may have one active
            wish. A wish may receive one donor at a time. Pooling, campaigns, targets, rewards and
            commercial solicitation are not allowed.
          </p>
          <p>
            <strong className="text-kindly-ink">Gift limits.</strong> Gifts are whole rupees from
            ₹10 to ₹100. The donor chooses the amount. Kindly does not process the payment, hold
            funds, guarantee a transfer, refund a payment or reopen a completed gift.
          </p>
          <p>
            <strong className="text-kindly-ink">Your content.</strong> Do not post phone numbers,
            raw UPI IDs, addresses, financial credentials, links, hate, threats, sexual content,
            personal data or anything unlawful. Kindly may hide or remove content and restrict
            accounts to protect people.
          </p>
          <p>
            <strong className="text-kindly-ink">Attestations.</strong> When a donor says they paid
            or a recipient confirms receipt, Kindly records that statement. It is not a bank
            verification. Disputes must go through the in-product support path and your bank or UPI
            provider.
          </p>
          <p>
            <strong className="text-kindly-ink">Safety and moderation.</strong> Reports are private.
            We may review, hide, restore, restrict, suspend or ban accounts and wishes. Moderation
            decisions can be appealed where the product offers an appeals path.
          </p>
          <p>
            <strong className="text-kindly-ink">Karma.</strong> Karma and badges are a private
            engagement record. They have no monetary value and cannot be bought, sold, transferred
            or redeemed for cash.
          </p>
          <p>
            <strong className="text-kindly-ink">Deletion.</strong> Account deletion is a reviewed
            request, not an instant erasure. Financial, safety and audit records may need to be
            retained. The final retention schedule is pending legal review.
          </p>
          <p>
            <strong className="text-kindly-ink">Real-money launch.</strong> Real-money production
            UPI handoff remains disabled until legal, bank/payment-partner and owner approvals are
            complete. Beta behaviour may change while those gates are open.
          </p>
        </div>
      </section>

      <section
        id="privacy"
        aria-labelledby="privacy-heading"
        className="scroll-mt-24 kindly-card p-5 sm:p-6"
      >
        <p className="kindly-eyebrow">Draft privacy outline</p>
        <h2
          id="privacy-heading"
          className="mt-1 font-display text-2xl font-semibold tracking-[-0.045em]"
        >
          Privacy
        </h2>
        <div className="mt-3 space-y-3 text-sm leading-6 text-kindly-muted">
          <p>
            <strong className="text-kindly-ink">What we collect.</strong> A private phone number for
            sign-in, a pseudonym and avatar, optional city, wish content, a protected UPI address,
            gift and attestation records, support/appeal messages, moderation records and security
            logs.
          </p>
          <p>
            <strong className="text-kindly-ink">What is public.</strong> Your pseudonym, avatar,
            wish message, mood, optional city, suggested amount and aggregate community activity.
            Your phone number, raw UPI address, payment references, support content, moderation
            notes and security logs are not public.
          </p>
          <p>
            <strong className="text-kindly-ink">Why we use it.</strong> To sign you in, publish your
            wish, open a direct UPI handoff, record attestations, prevent abuse, resolve support
            cases, run safety checks and improve reliability.
          </p>
          <p>
            <strong className="text-kindly-ink">What we do not do.</strong> We do not sell personal
            data, run ads, show public donor-to-recipient money-flow maps, or use private payment
            details to verify a bank transfer.
          </p>
          <p>
            <strong className="text-kindly-ink">Retention and rights.</strong> Retention periods are
            not final. Deletion requests are recorded and reviewed; some financial, safety and audit
            records may be kept. The final process, contact channel and statutory rights will be
            published after legal review.
          </p>
          <p>
            <strong className="text-kindly-ink">Service providers.</strong> Production SMS, cloud,
            key-management and payment-partner providers are not yet selected. When selected, they
            will be disclosed in the final policy.
          </p>
        </div>
      </section>

      <section
        id="accessibility"
        aria-labelledby="accessibility-heading"
        className="scroll-mt-24 kindly-card p-5 sm:p-6"
      >
        <p className="kindly-eyebrow">Draft accessibility statement</p>
        <h2
          id="accessibility-heading"
          className="mt-1 font-display text-2xl font-semibold tracking-[-0.045em]"
        >
          Accessibility
        </h2>
        <div className="mt-3 space-y-3 text-sm leading-6 text-kindly-muted">
          <p>
            Kindly aims for WCAG 2.2 AA. We use semantic HTML, keyboard-accessible controls, visible
            focus states, reduced-motion support and text alternatives for visual status cues. This
            is a goal, not a claim of certification.
          </p>
          <p>
            Automated checks and manual keyboard/browser checks are part of the release process, but
            a full screen-reader and assistive-technology matrix is still pending. The admin
            console, data tables and future charts need dedicated manual review.
          </p>
          <p>
            A monitored accessibility feedback channel is not yet published. Until then, use the
            in-product report or support paths, and mention accessibility in the message.
          </p>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-2 border-t border-kindly-border pt-5">
        <Link href="/safety" className="kindly-btn-secondary">
          Safety centre
        </Link>
        <Link href="/appeals" className="kindly-btn-secondary">
          Appeals
        </Link>
        <Link href="/about" className="kindly-btn-quiet">
          About Kindly
        </Link>
      </section>
    </div>
  );
}
