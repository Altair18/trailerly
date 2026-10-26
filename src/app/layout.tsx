import type { Metadata, Viewport } from "next";
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

const FONTS =
  "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,500..900&family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>{children}</body>
    </html>
  );
}
