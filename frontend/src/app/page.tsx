import Link from "next/link";

import { DiscoverFeed } from "@/components/discovery/discover-feed";
import { HealthCheck } from "@/components/health-check";

const steps = [
  {
    title: "Browse a wish",
    body: "Read a short, pseudonymous note. No campaigns, targets or proof-of-use.",
  },
  {
    title: "Send a small gift",
    body: "Choose a whole-rupee amount from ₹10 to ₹100 and pay directly over UPI.",
  },
  {
    title: "Confirm honestly",
    body: "The donor attests what happened; the recipient confirms receipt. Kindly never holds funds.",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-kindly-border sm:p-10">
        <p className="text-sm font-semibold tracking-wide text-kindly-accent uppercase">
          Bengaluru private beta
        </p>
        <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">
          Small gifts. No campaigns. Just kindness.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-kindly-muted">
          Kindly is a lightweight, pseudonymous space for spontaneous micro-gifts between people.
          Visitors can browse. Sign in before selecting a wish, posting, or reporting.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/sign-in"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-kindly-accent px-5 py-3 text-sm font-semibold text-white hover:bg-orange-800"
          >
            Sign in to give
          </Link>
          <Link
            href="/wishes/demo"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-kindly-border bg-white px-5 py-3 text-sm font-semibold text-kindly-ink hover:bg-kindly-accent-soft"
          >
            Preview a wish
          </Link>
        </div>
        <p className="mt-4 text-sm text-kindly-muted">
          Gifts are whole rupees from ₹10 to ₹100, paid directly over UPI. Kindly never holds your
          money.
        </p>
      </section>

      <section aria-labelledby="how-it-works">
        <h2 id="how-it-works" className="text-xl font-semibold tracking-tight sm:text-2xl">
          How it works
        </h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-3">
          {steps.map((step) => (
            <li key={step.title} className="rounded-2xl border border-kindly-border bg-white p-5">
              <h3 className="font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-kindly-muted">{step.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <DiscoverFeed />

      <HealthCheck />
    </div>
  );
}
