"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { logout, type UserProfile } from "@/lib/auth/session";
import { useSessionUser } from "@/lib/auth/use-session-user";

const primaryLinks = [
  { href: "/", label: "Discover" },
  { href: "/me", label: "My space" },
  { href: "/notifications", label: "Notifications" },
] as const;

function hasAdminAccess(user: UserProfile): boolean {
  return user.role === "ADMIN" || user.role === "MODERATOR";
}

function initialFor(user: UserProfile): string {
  return user.displayName?.trim().slice(0, 1).toUpperCase() || "K";
}

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeaderFallback() {
  return (
    <header
      aria-hidden="true"
      className="sticky top-0 z-40 border-b border-kindly-border/80 bg-kindly-cream/90 backdrop-blur-md"
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <span className="flex items-center gap-2.5 py-1 pr-1 text-kindly-ink">
          <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-kindly-accent text-kindly-cream shadow-sm">
            <Icon name="heart" className="h-[18px] w-[18px]" />
          </span>
          <span className="font-display text-xl font-semibold tracking-[-0.05em]">Kindly</span>
        </span>
        <span className="h-9 w-28 animate-pulse rounded-full bg-kindly-accent-soft/70" />
      </div>
    </header>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, setUser } = useSessionUser();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountMenuOpen) {
      return;
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [accountMenuOpen]);

  useEffect(() => {
    if (!accountMenuOpen) {
      return;
    }
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (event.target instanceof Node && !accountMenuRef.current?.contains(event.target)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [accountMenuOpen]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await logout();
      setUser(null);
      setAccountMenuOpen(false);
      router.push("/");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  const links =
    user && hasAdminAccess(user)
      ? [...primaryLinks, { href: "/admin", label: "Admin console" }]
      : [...primaryLinks];

  return (
    <header className="sticky top-0 z-40 border-b border-kindly-border/80 bg-kindly-cream/90 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-xl py-1 pr-1 text-kindly-ink"
          aria-label="Kindly home"
        >
          <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-kindly-accent text-kindly-cream shadow-[0_3px_0_rgb(23_59_51_/_12%)]">
            <Icon name="heart" className="h-[18px] w-[18px]" />
          </span>
          <span className="font-display text-xl font-semibold tracking-[-0.05em]">Kindly</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {links.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-kindly-accent-soft text-kindly-accent"
                    : "text-kindly-muted hover:bg-kindly-card hover:text-kindly-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user === undefined ? (
            <span className="flex items-center gap-2" aria-live="polite">
              <span
                aria-hidden="true"
                className="h-9 w-9 animate-pulse rounded-full bg-kindly-accent-soft"
              />
              <span className="sr-only">Checking your session</span>
            </span>
          ) : user ? (
            <div ref={accountMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setAccountMenuOpen((open) => !open)}
                aria-expanded={accountMenuOpen}
                aria-controls="account-menu"
                className="flex min-h-10 max-w-48 items-center gap-2 rounded-full border border-kindly-border bg-kindly-card py-1 pr-2.5 pl-1 text-sm font-semibold text-kindly-ink hover:border-kindly-accent"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-kindly-blush font-display text-xs font-bold text-kindly-ink">
                  {initialFor(user)}
                </span>
                <span className="truncate">{user.displayName ?? "Finish your profile"}</span>
                <Icon
                  name="chevron-down"
                  className={`h-4 w-4 shrink-0 text-kindly-muted transition-transform ${
                    accountMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {accountMenuOpen && (
                <div
                  id="account-menu"
                  className="absolute right-0 z-50 mt-2 w-60 rounded-2xl border border-kindly-border bg-kindly-card p-1.5 shadow-xl"
                >
                  <p className="px-3 py-2 text-xs text-kindly-muted">
                    Signed in as{" "}
                    <span className="font-semibold text-kindly-ink">
                      {user.displayName ?? "Kindly user"}
                    </span>
                  </p>
                  <Link
                    href="/appeals"
                    onClick={() => setAccountMenuOpen(false)}
                    className="flex min-h-10 items-center rounded-xl px-3 py-2 text-sm font-medium text-kindly-ink hover:bg-kindly-accent-soft"
                  >
                    Appeals
                  </Link>
                  <Link
                    href="/account-deletion"
                    onClick={() => setAccountMenuOpen(false)}
                    className="flex min-h-10 items-center rounded-xl px-3 py-2 text-sm font-medium text-kindly-ink hover:bg-kindly-accent-soft"
                  >
                    Account deletion
                  </Link>
                  <div className="my-1 border-t border-kindly-border" />
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="flex min-h-10 w-full items-center rounded-xl px-3 py-2 text-left text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    {signingOut ? "Signing out…" : "Sign out"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/sign-in"
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-kindly-accent px-4 py-2 text-sm font-bold text-white shadow-[0_3px_0_rgb(23_59_51_/_12%)] hover:bg-kindly-accent-dark"
            >
              Sign in
            </Link>
          )}
        </div>

        <span className="rounded-full border border-kindly-border bg-kindly-card px-3 py-1 text-[9px] font-extrabold tracking-[0.12em] text-kindly-muted uppercase md:hidden">
          Bengaluru beta
        </span>
      </div>
    </header>
  );
}
