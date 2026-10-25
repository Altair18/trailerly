import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trailerly",
  description: "App Store and social videos from one screen recording, rule-checked.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
