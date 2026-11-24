"use client";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <section className="kindly-card mx-auto max-w-xl p-8 text-center">
      <p className="kindly-eyebrow">Something went wrong</p>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.055em]">
        We could not load this page
      </h1>
      <p className="mt-3 text-sm leading-6 text-kindly-muted">
        Nothing was charged. Try again, or return to discovery.
      </p>
      <button type="button" onClick={reset} className="kindly-btn-primary mt-6">
        Try again
      </button>
    </section>
  );
}
