import type { Metadata } from "next";
import Link from "next/link";

type WishPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: WishPageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Wish ${id.slice(0, 8)}` };
}

export default async function WishDetailPage({ params }: WishPageProps) {
  const { id } = await params;

  return (
    <article className="mx-auto max-w-2xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-kindly-border sm:p-8">
      <p className="text-sm font-semibold tracking-wide text-kindly-accent uppercase">
        Wish preview
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
        A small wish for a long day
      </h1>
      <p className="mt-4 text-base leading-7 text-kindly-muted">
        This placeholder shows where a pseudonymous wish will appear. Real wish content, mood and
        optional suggested amount arrive with Phase 3–4.
      </p>
      <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-xl bg-kindly-accent-soft p-4">
          <dt className="font-medium text-kindly-muted">Mood</dt>
          <dd className="mt-1 font-semibold">Just because</dd>
        </div>
        <div className="rounded-xl bg-kindly-accent-soft p-4">
          <dt className="font-medium text-kindly-muted">Suggested amount</dt>
          <dd className="mt-1 font-semibold">₹25 (donor chooses)</dd>
        </div>
      </dl>
      <p className="mt-6 rounded-xl border border-kindly-border p-4 text-sm text-kindly-muted">
        Guests can browse. Sign in before selecting a wish or starting a gift. Kindly never shows
        the recipient&apos;s phone number or payment address publicly.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/sign-in"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-kindly-accent px-5 py-3 text-sm font-semibold text-white hover:bg-orange-800"
        >
          Sign in to select
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-kindly-border px-5 py-3 text-sm font-semibold hover:bg-kindly-accent-soft"
        >
          Back to discovery
        </Link>
      </div>
      <p className="mt-4 text-xs text-kindly-muted">Preview route: /wishes/{id.slice(0, 12)}</p>
    </article>
  );
}
