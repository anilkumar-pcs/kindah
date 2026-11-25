import Link from "next/link";

const exploreLinks = [
  { href: "/", label: "Home" },
  { href: "/discover", label: "Discover" },
  { href: "/me#wish", label: "Share a wish" },
  { href: "/me", label: "My Space" },
];

const trustLinks = [
  { href: "/about", label: "About Kindly" },
  { href: "/safety", label: "Safety centre" },
  { href: "/appeals", label: "Appeals" },
  { href: "/account-deletion", label: "Account deletion" },
];

const legalLinks = [
  { href: "/legal#privacy", label: "Privacy" },
  { href: "/legal#terms", label: "Terms" },
  { href: "/legal#accessibility", label: "Accessibility" },
];

export function SiteFooter() {
  return (
    <footer className="mt-8 border-t border-kindly-ink/10 bg-kindly-ink text-kindly-cream">
      <div className="mx-auto w-full max-w-6xl px-4 pt-10 pb-24 sm:px-6 md:pb-10">
        <div className="grid gap-8 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 font-display text-2xl font-semibold tracking-[-0.05em]"
            >
              <span
                aria-hidden="true"
                className="grid h-9 w-9 place-items-center rounded-full bg-kindly-marigold text-kindly-ink"
              >
                k
              </span>
              Kindly
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-6 text-kindly-cream/70">
              A warm little place for spontaneous kindness. One wish, one donor, ₹10 to ₹100.
            </p>
          </div>

          <nav aria-label="Explore Kindly">
            <h2 className="text-[10px] font-extrabold tracking-[0.16em] text-kindly-cream/55 uppercase">
              Explore
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              {exploreLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-kindly-cream/80 underline-offset-4 hover:text-kindly-marigold hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Trust and support">
            <h2 className="text-[10px] font-extrabold tracking-[0.16em] text-kindly-cream/55 uppercase">
              Trust
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              {trustLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-kindly-cream/80 underline-offset-4 hover:text-kindly-marigold hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Legal and accessibility">
            <h2 className="text-[10px] font-extrabold tracking-[0.16em] text-kindly-cream/55 uppercase">
              The fine print
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-kindly-cream/80 underline-offset-4 hover:text-kindly-marigold hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-8 rounded-2xl border border-kindly-cream/15 bg-kindly-cream/[0.06] p-4 text-xs leading-6 text-kindly-cream/70">
          <p className="font-bold text-kindly-marigold">What Kindly is — and is not</p>
          <p className="mt-1.5">
            Kindly is a pseudonymous little-gift service, not a charity, crowdfunding platform,
            wallet, escrow, or payment processor. Gifts move directly over UPI between two people.
            Kindly does not hold or verify money and cannot guarantee a wish, a gift, or how a
            recipient uses it. Statuses such as “donor says paid” and “recipient confirmed” are
            attestations. One active wish per person; one donor per wish; no pooling. 18+ only.
          </p>
          <p className="mt-2">
            Privacy, terms and accessibility pages are working drafts and need legal review before
            launch. Kindly does not sell data or show ads.{" "}
            <Link href="/legal" className="font-semibold text-kindly-cream underline">
              Read the draft declarations
            </Link>
            .
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2 border-t border-kindly-cream/10 pt-5 text-[11px] text-kindly-cream/50 sm:flex-row sm:items-center sm:justify-between">
          <p>Little things add up.</p>
          <p>No campaigns. No targets. No cash-value karma.</p>
        </div>
      </div>
    </footer>
  );
}
