import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

// The Figma Foundations collection specifies Inter. Without actually loading it
// the stack falls through to a system serif, so this is not cosmetic.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Same reasoning as Inter: the mono token named a family nobody loaded, so
// every font-mono on the site was rendering as SF Mono or Menlo.
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Vianova Design System",
    template: "%s — Vianova Design System",
  },
  description:
    "Brand foundations and production-ready components for Vianova's spatial intelligence platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${geistMono.variable}`}>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
