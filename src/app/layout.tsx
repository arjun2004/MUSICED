import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "MUSICED — Discover. Listen. Rate. Repeat.",
    template: "%s · MUSICED",
  },
  description:
    "MUSICED is a social network for music lovers. Keep a listening diary, rate and review albums, build lists, and discover music through people with great taste.",
  applicationName: "MUSICED",
  openGraph: {
    type: "website",
    siteName: "MUSICED",
    title: "MUSICED — Discover. Listen. Rate. Repeat.",
    description: "Keep a listening diary, rate albums, and discover music through people with great taste.",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#151719",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-signal px-3 py-2 text-sm font-medium text-signal-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
