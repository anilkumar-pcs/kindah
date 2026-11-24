import Link from "next/link";

export default function NotFound() {
  return (
    <section className="kindly-card mx-auto max-w-xl p-8 text-center">
      <p className="kindly-eyebrow">404</p>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.055em]">
        This page is not here
      </h1>
      <p className="mt-3 text-sm leading-6 text-kindly-muted">
        The wish may have expired, been withdrawn, or the link may be wrong.
      </p>
      <Link href="/" className="kindly-btn-primary mt-6">
        Back to discovery
      </Link>
    </section>
  );
}
