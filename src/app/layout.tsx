import type { Metadata, Viewport } from "next";
import { Archivo, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const DESCRIPTION =
  "App Store preview, iOS 27 header and search videos from one screen recording, each checked against Apple's rules. Free drafts, pay once per pack.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://trailerly-navy.vercel.app"),
  title: { default: "Trailerly: App Store videos from one screen recording", template: "%s · Trailerly" },
  description: DESCRIPTION,
  applicationName: "Trailerly",
  openGraph: { type: "website", siteName: "Trailerly", title: "Trailerly: a trailer for your app", description: DESCRIPTION, locale: "en_GB" },
  twitter: { card: "summary_large_image", title: "Trailerly: a trailer for your app", description: DESCRIPTION },
};

export const viewport: Viewport = { themeColor: "#050507", colorScheme: "dark" };

// Fonts are downloaded at build time and served from our own domain: no render-blocking request to Google,
// and visitors' browsers never contact Google Fonts.
const display = Archivo({ subsets: ["latin"], axes: ["wdth"], display: "swap", variable: "--f-display" });
const ui = Geist({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--f-ui" });
const mono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], display: "swap", variable: "--f-mono" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
