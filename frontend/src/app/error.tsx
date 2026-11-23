"use client";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <section className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-kindly-border">
      <p className="text-sm font-semibold tracking-wide text-kindly-accent uppercase">
        Something went wrong
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">We could not load this page</h1>
      <p className="mt-3 text-sm leading-6 text-kindly-muted">
        Nothing was charged. Try again, or return to discovery.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-kindly-accent px-5 py-3 text-sm font-semibold text-white hover:bg-orange-800"
      >
        Try again
      </button>
    </section>
  );
}
