import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Social share card (Open Graph and Twitter). Drawn at build time in the brand colours with Archivo
// (static TTF instances cut from public/fonts/archivo-latin.woff2, since the renderer can't read woff2 or variable fonts).
export const alt = "Trailerly: App Store videos from one screen recording";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const [black, semi] = await Promise.all([
    readFile(join(process.cwd(), "src/app/og-archivo-black.ttf")),
    readFile(join(process.cwd(), "src/app/og-archivo-semibold.ttf")),
  ]);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(120deg, #FF2E88 0%, #9D7BFF 55%, #FF7A1A 100%)",
          color: "#0A0A0E",
          fontFamily: "Archivo",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 64, height: 46, borderRadius: 12, background: "#0A0A0E", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="22" height="22" viewBox="0 0 24 24"><path d="M6 3v18l15-9z" fill="#FF2E88" /></svg>
          </div>
          <div style={{ fontSize: 50, fontWeight: 900, letterSpacing: -1 }}>trailerly</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 128, fontWeight: 900, lineHeight: 0.92, letterSpacing: -2, color: "#fff", maxWidth: 1060 }}>A trailer for your app</div>
          <div style={{ fontSize: 36, fontWeight: 600, maxWidth: 960, lineHeight: 1.2 }}>App Store preview, iOS 27 header and search videos from one screen recording, checked against Apple&apos;s rules.</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Archivo", data: black, weight: 900, style: "normal" },
        { name: "Archivo", data: semi, weight: 600, style: "normal" },
      ],
    },
  );
}
