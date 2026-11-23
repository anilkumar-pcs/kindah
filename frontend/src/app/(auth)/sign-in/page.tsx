import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function SignInPage() {
  return (
    <section className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-kindly-border sm:p-8">
      <p className="text-sm font-semibold tracking-wide text-kindly-accent uppercase">
        Authentication
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
        Sign in with your mobile number
      </h1>
      <p className="mt-4 text-sm leading-6 text-kindly-muted">
        One-time-password sign-in, 18+ confirmation and profile setup arrive in Phase 2. This shell
        intentionally does not collect a phone number yet.
      </p>
      <div className="mt-6 rounded-xl border border-kindly-border bg-kindly-accent-soft p-4 text-sm text-kindly-muted">
        Interactive actions require authentication. Browsing remains available to guests.
      </div>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl border border-kindly-border px-5 py-3 text-sm font-semibold hover:bg-kindly-accent-soft"
      >
        Back to discovery
      </Link>
    </section>
  );
}
