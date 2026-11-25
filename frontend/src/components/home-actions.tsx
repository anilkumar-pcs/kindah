"use client";

import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { useSessionUser } from "@/lib/auth/use-session-user";

const primaryClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-kindly-accent px-5 py-3 text-sm font-bold text-white shadow-[0_4px_0_rgb(23_59_51_/_13%)] hover:bg-kindly-accent-dark";
const secondaryClass =
  "inline-flex min-h-11 items-center justify-center rounded-2xl border border-kindly-border bg-kindly-card px-5 py-3 text-sm font-bold text-kindly-ink hover:bg-kindly-accent-soft";

export function HomeActions() {
  const { user } = useSessionUser();

  if (user === undefined) {
    return (
      <div className="mt-6 flex flex-wrap gap-3" aria-hidden="true">
        <span className="h-12 w-36 animate-pulse rounded-2xl bg-kindly-accent-soft" />
        <span className="h-12 w-32 animate-pulse rounded-2xl bg-kindly-card ring-1 ring-kindly-border" />
      </div>
    );
  }

  const shareHref = !user ? "/sign-in?next=%2Fme" : user.onboardingRequired ? "/sign-in" : "/me";

  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <Link href="/discover" className={primaryClass}>
        Find a wish
        <Icon name="arrow-right" className="h-4 w-4" />
      </Link>
      <Link href={shareHref} className={secondaryClass}>
        Share a wish
      </Link>
    </div>
  );
}
