"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import { logout, type UserProfile } from "@/lib/auth/session";
import { useSessionUser } from "@/lib/auth/use-session-user";

const tabs: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/", label: "Discover", icon: "compass" },
  { href: "/me", label: "My Space", icon: "heart" },
  { href: "/notifications", label: "Updates", icon: "bell" },
];

const hiddenPrefixes = ["/sign-in", "/reauth", "/gifts/new"];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/" || pathname.startsWith("/wishes/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isAccountActive(pathname: string): boolean {
  return (
    pathname.startsWith("/appeals") ||
    pathname.startsWith("/account-deletion") ||
    pathname.startsWith("/admin")
  );
}

function hasAdminAccess(user: UserProfile): boolean {
  return user.role === "ADMIN" || user.role === "MODERATOR";
}

function initialFor(user: UserProfile): string {
  return user.displayName?.trim().slice(0, 1).toUpperCase() || "K";
}

export function MobileTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, setUser } = useSessionUser();
  const [accountOpen, setAccountOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!accountOpen) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountOpen(false);
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountOpen]);

  if (hiddenPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return null;
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await logout();
      setUser(null);
      setAccountOpen(false);
      router.push("/");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  const accountIsActive = accountOpen || isAccountActive(pathname);
  const signInHref =
    pathname === "/" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(pathname)}`;

  return (
    <>
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-kindly-border bg-kindly-card/95 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto grid max-w-md grid-cols-4 px-3 py-2">
          {tabs.map((tab) => {
            const active = isActive(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-bold ${
                  active ? "text-kindly-accent" : "text-kindly-muted"
                }`}
              >
                <span
                  className={`grid h-8 w-11 place-items-center rounded-full transition-colors ${
                    active ? "bg-kindly-accent-soft" : "bg-transparent"
                  }`}
                >
                  <Icon name={tab.icon} className="h-[19px] w-[19px]" />
                </span>
                {tab.label}
              </Link>
            );
          })}

          {user === undefined ? (
            <span
              aria-hidden="true"
              className="flex min-h-14 flex-col items-center justify-center gap-1"
            >
              <span className="h-8 w-11 animate-pulse rounded-full bg-kindly-accent-soft" />
              <span className="h-2 w-10 animate-pulse rounded-full bg-kindly-accent-soft" />
            </span>
          ) : user ? (
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen(true)}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-bold ${
                accountIsActive ? "text-kindly-accent" : "text-kindly-muted"
              }`}
            >
              <span
                className={`grid h-8 w-11 place-items-center rounded-full transition-colors ${
                  accountIsActive ? "bg-kindly-accent-soft" : "bg-transparent"
                }`}
              >
                <Icon name="user" className="h-[19px] w-[19px]" />
              </span>
              Account
            </button>
          ) : (
            <Link
              href={signInHref}
              className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-bold text-kindly-muted"
            >
              <span className="grid h-8 w-11 place-items-center rounded-full">
                <Icon name="user" className="h-[19px] w-[19px]" />
              </span>
              Sign in
            </Link>
          )}
        </div>
      </nav>

      {accountOpen && user && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-account-title"
        >
          <button
            type="button"
            aria-label="Dismiss account menu"
            className="absolute inset-0 bg-kindly-ink/35 backdrop-blur-[2px]"
            onClick={() => setAccountOpen(false)}
          />
          <section
            className="absolute inset-x-0 bottom-0 rounded-t-[2rem] bg-kindly-card px-5 pt-3 shadow-[0_-20px_60px_rgb(23_59_51_/_24%)]"
            style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-kindly-border" />
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-kindly-blush font-display text-sm font-bold text-kindly-ink">
                  {initialFor(user)}
                </span>
                <div>
                  <h2
                    id="mobile-account-title"
                    className="font-display text-xl font-semibold tracking-[-0.04em]"
                  >
                    {user.displayName ?? "Your account"}
                  </h2>
                  <p className="mt-0.5 text-xs text-kindly-muted">Signed in to Kindly</p>
                </div>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setAccountOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full border border-kindly-border bg-kindly-card text-kindly-muted"
              >
                <span className="sr-only">Close account menu</span>
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>

            <nav aria-label="Account menu" className="mt-5 grid gap-1">
              <Link
                href="/appeals"
                onClick={() => setAccountOpen(false)}
                className="flex min-h-12 items-center rounded-2xl px-3 text-sm font-bold text-kindly-ink hover:bg-kindly-accent-soft"
              >
                Appeals
              </Link>
              <Link
                href="/account-deletion"
                onClick={() => setAccountOpen(false)}
                className="flex min-h-12 items-center rounded-2xl px-3 text-sm font-bold text-kindly-ink hover:bg-kindly-accent-soft"
              >
                Account deletion
              </Link>
              {hasAdminAccess(user) && (
                <Link
                  href="/admin"
                  onClick={() => setAccountOpen(false)}
                  className="flex min-h-12 items-center rounded-2xl px-3 text-sm font-bold text-kindly-ink hover:bg-kindly-accent-soft"
                >
                  Admin console
                </Link>
              )}
            </nav>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="mt-3 flex min-h-12 w-full items-center rounded-2xl px-3 text-left text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </section>
        </div>
      )}
    </>
  );
}
