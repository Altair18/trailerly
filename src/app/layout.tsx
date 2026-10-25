import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trailerly",
  description: "App Store and social videos from one screen recording, rule-checked.",
};

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
