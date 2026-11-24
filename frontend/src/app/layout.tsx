import type { Metadata, Viewport } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Kindly — small acts of kindness",
    template: "%s · Kindly",
  },
  description: "A pseudonymous micro-gifting platform for spontaneous small acts of kindness.",
  applicationName: "Kindly",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#fff7ed",
  width: "device-width",
  initialScale: 1,
};

const navItems = [
  { href: "/", label: "Discover" },
  { href: "/me", label: "My space" },
  { href: "/sign-in", label: "Sign in" },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <header className="border-b border-kindly-border bg-white/80">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link
              href="/"
              className="rounded-lg px-1 py-2 text-lg font-semibold tracking-tight text-kindly-accent"
            >
              Kindly
            </Link>
            <nav aria-label="Primary" className="flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-kindly-muted hover:bg-kindly-accent-soft hover:text-kindly-ink"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main id="main-content" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
          {children}
        </main>
        <footer className="border-t border-kindly-border px-4 py-6 text-center text-sm text-kindly-muted">
          <p>Small acts of kindness. No campaigns, no targets, no proof-of-use.</p>
        </footer>
      </body>
    </html>
  );
}
