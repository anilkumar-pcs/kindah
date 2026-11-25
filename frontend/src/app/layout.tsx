import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Caveat, Plus_Jakarta_Sans } from "next/font/google";
import { Suspense, type ReactNode } from "react";

import { MobileTabBar } from "@/components/mobile-tab-bar";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader, SiteHeaderFallback } from "@/components/site-header";

import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
});

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
  themeColor: "#fff8ec",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${jakarta.variable} ${caveat.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <Suspense fallback={<SiteHeaderFallback />}>
          <SiteHeader />
        </Suspense>
        <main
          id="main-content"
          className="app-main mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 md:py-8"
        >
          {children}
        </main>
        <Suspense fallback={null}>
          <MobileTabBar />
        </Suspense>
        <SiteFooter />
      </body>
    </html>
  );
}
