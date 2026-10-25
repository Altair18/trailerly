import Link from "next/link";
import { TopBar } from "@/components/TopBar";

export default function Home() {
  return (
    <>
      <TopBar />
      <main className="wrap" style={{ paddingTop: 40, paddingBottom: 80 }}>
        <div className="tile rise" style={{ minHeight: 440, borderRadius: 26 }}>
          <div className="kb flow" style={{ backgroundImage: "linear-gradient(120deg,#FF2E88,#9D7BFF,#38D9FF)" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(0,0,0,.75),rgba(0,0,0,.05) 75%)", zIndex: 1 }} />
          <div style={{ position: "relative", zIndex: 2, padding: "56px 48px", display: "grid", gap: 22, maxWidth: 720 }}>
            <h1 className="disp" style={{ margin: 0, fontSize: "clamp(52px, 9vw, 104px)", color: "#fff" }}>
              One recording. Eight videos. Zero rejections.
            </h1>
            <p style={{ margin: 0, fontSize: 18, color: "#E4E3EC", maxWidth: 520 }}>
              Paste an App Store link and a screen recording. Get 3 App Store videos and 5 social ads, each checked
              against Apple&apos;s rules before you pay.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link className="btn btn-primary" href="/packs/new">Start a pack</Link>
              <Link className="btn btn-ghost" href="/login">Sign in</Link>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
