import Link from "next/link";
import { ExampleGrid } from "@/components/landing/ExampleGrid";
import { Hero } from "@/components/landing/Hero";
import { LinkBar } from "@/components/landing/LinkBar";
import { Compare } from "@/components/landing/Compare";
import { CHECKOUT_LIVE, PRICES } from "@/components/landing/pricing";
import { RecordingToPack } from "@/components/landing/RecordingToPack";
import { Logo } from "@/components/TopBar";
import "./landing.css";

// Landing page, built from the approved option B frame. Social ads and checkout are not live yet, so they say "coming soon".
// Prices come from components/landing/pricing.ts.

const STRIP = [
  ["App Store preview, 886×1920", "var(--pink)"],
  ["Header video, 21:9 loop", "var(--cyan)"],
  ["Search video, 3:2", "var(--lime)"],
  ["Header, search and universal stills", "var(--yel)"],
  ["A/B variants for Product Page tests", "var(--orange)"],
  ["Rules checked before export", "var(--mint)"],
  ["Shot list for your recording", "var(--purple)"],
  ["5 social ads (coming soon)", "var(--coral)"],
] as const;

const Check = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0A0A0E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const RULES: { text: string; ok: boolean }[] = [
  { text: "Preview is screen capture only", ok: true },
  { text: "No prices in App Store videos", ok: true },
  { text: "“Best” wording in the search video", ok: false },
  { text: "Length fits the slot", ok: true },
  { text: "Every AI scene labelled", ok: true },
];

const STEPS = [
  { t: "Paste your App Store link", d: "We read your name, icon, screenshots, description and recent reviews.", c: "var(--pink)" },
  { t: "Record 20 to 60 seconds", d: "Follow a shot list made for your app. We cut it into clips and flag dead time.", c: "var(--yel)" },
  { t: "Pick your hooks", d: "Choose a headline from 10 hooks written from your reviews. Edit any of them.", c: "var(--cyan)" },
  { t: "Preview free drafts", d: "Watch every video with its rules results before you spend anything.", c: "var(--lime)" },
  { t: CHECKOUT_LIVE ? "Download the pack" : "Download the pack (soon)", d: "Full-size files, named for where each one goes in App Store Connect.", c: "var(--purple)" },
];

const FAQ = [
  {
    q: "What do I need to start?",
    a: "Your App Store link and a 20 to 60 second screen recording of your app. iPhone's built-in screen recorder is fine. We give you a shot list so you know what to capture.",
  },
  {
    q: "Which videos are in a pack today?",
    a: "The App Store preview (886×1920), the iOS 27 header video (21:9) and search video (3:2), header, search and universal stills, and B and C variants of the header and search videos when you pick extra hooks. Five vertical social ads for TikTok, Reels and Shorts are coming next.",
  },
  {
    q: "Will Apple accept the preview?",
    a: "The App Store preview uses only footage from your recording, as Apple requires, and is checked for length, size, prices and wording before you download. Apple makes the final call in review, so we show you every check we ran.",
  },
  {
    q: "Do you use AI video?",
    a: "Never in the App Store preview. The header and search videos can include a short AI scene, and every AI scene is labelled in the rules check so you know exactly where it is.",
  },
  {
    q: "How much does it cost?",
    a: `Drafts are free to make and preview. ${PRICES.launch ? `The App Store pack will be ${PRICES.launch}, paid once` : "A pack will be a one-off payment"}, with no subscription.${CHECKOUT_LIVE ? "" : " Checkout is being set up now, so paid downloads open soon."}`,
  },
  {
    q: "What happens to my reviews and recording?",
    a: "Reviews are used to write hooks; reviewer names are never kept. Your recording is only used to make your pack.",
  },
];

export default function Home() {
  return (
    <>
      <p className="lp-ios flow">
        <span className="lp-tag">iOS 27 ready</span>
        Header and search videos are live in App Store Connect. <a href="#pack">See what&apos;s in a pack</a>
      </p>
      <header className="topbar">
        <div className="wrap">
          <Logo />
          <nav aria-label="Main" className="lp-nav">
            <a className="lp-nl" href="#explore">Examples</a>
            <a className="lp-nl" href="#pack">What&apos;s in a pack</a>
            <a className="lp-nl" href="#rules">Rules check <span className="lp-new">New</span></a>
            <a className="lp-nl" href="#compare">Compare</a>
            <a className="lp-nl" href="#pricing">Pricing</a>
          </nav>
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <Link className="btn btn-ghost" href="/login" style={{ minHeight: 40 }}>Log in</Link>
            <Link className="btn btn-light" href="/packs/new" style={{ minHeight: 40 }}>Start a pack</Link>
          </div>
        </div>
      </header>

      <main>
        <Hero />
        <LinkBar />

        <section className="lp-strip" aria-label="What's in a pack">
          <ul className="lp-mq">
            {[...STRIP, ...STRIP].map(([label, c], k) => (
              <li key={k} aria-hidden={k >= STRIP.length || undefined}>
                <i style={{ background: c }} />
                {label}
              </li>
            ))}
          </ul>
        </section>

        <RecordingToPack />

        <section id="rules" className="wrap lp-sec">
          <div className="lp-tile lp-rules">
            <div className="flow" style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(120deg,#101015,#1E1033,#0B2A2A,#101015)" }} />
            <div style={{ position: "relative", zIndex: 2, padding: 56, display: "flex", gap: 48, alignItems: "center", flexWrap: "wrap", width: "100%" }}>
              <div style={{ flex: "1 1 380px" }}>
                <span className="lp-new" style={{ fontSize: 11 }}>New</span>
                <h2 className="disp" style={{ margin: "14px 0 12px", fontSize: "clamp(44px, 6vw, 64px)" }}>Checked before you ship it</h2>
                <p style={{ margin: "0 0 24px", color: "#D7D6E0", fontSize: 17, maxWidth: 480 }}>
                  Apple&apos;s rules for each slot run on every video, so you see what would get rejected before you upload it.
                </p>
                <Link className="btn btn-light" href="/packs/new">Try it on my app</Link>
              </div>
              <ul style={{ flex: "1 1 400px", display: "grid", gap: 10, listStyle: "none", margin: 0, padding: 0 }}>
                {RULES.map((r) => (
                  <li key={r.text} className="lp-rule" style={r.ok ? undefined : { background: "rgba(255,225,53,.1)" }}>
                    <span className="ic" style={{ background: r.ok ? "var(--lime)" : "var(--yel)" }}>{r.ok ? <Check /> : "!"}</span>
                    {r.text}
                    <span className="st" style={{ color: r.ok ? "var(--lime)" : "var(--yel)" }}>{r.ok ? "PASS" : "WARN"}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <Compare />

        <ExampleGrid />

        <section id="how" className="wrap lp-sec">
          <div className="lp-head">
            <div>
              <h2 className="disp lp-h2">How it works</h2>
              <p className="mu">From link to finished pack in one sitting.</p>
            </div>
          </div>
          <ol className="lp-steps">
            {STEPS.map((s, k) => (
              <li key={s.t}>
                <span className="n disp" style={{ background: s.c }}>{k + 1}</span>
                <h3>{s.t}</h3>
                <p className="mu">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="pricing" className="wrap lp-sec">
          <div className="lp-tile lp-price">
            <div className="kb flow" style={{ backgroundImage: "linear-gradient(120deg,#FF2E88,#FF7A1A,#FFE135,#9D7BFF)" }} />
            <div style={{ position: "relative", zIndex: 2, padding: "48px 20px", color: "var(--ink)", width: "100%" }}>
              <p className="mono" style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, letterSpacing: ".14em", textTransform: "uppercase" }}>Pay once per pack</p>
              <h2 className="disp" style={{ margin: "0 0 24px", fontSize: "clamp(48px, 8vw, 80px)" }}>No subscription</h2>
              <div className="lp-tiers">
                <div className="lp-tier">
                  <b>Launch pack</b>
                  <span className={`disp amt${PRICES.launch ? "" : " tbc"}`}>{PRICES.launch ?? "Price coming soon"}</span>
                  <ul>
                    <li>App Store preview</li>
                    <li>Header and search videos</li>
                    <li>Header, search and universal stills</li>
                    <li>Rules report</li>
                  </ul>
                </div>
                <div className="lp-tier">
                  <b>Full pack</b>
                  <span className={`disp amt${PRICES.full ? "" : " tbc"}`}>{PRICES.full ?? "Price coming soon"}</span>
                  <ul>
                    <li>Everything in the launch pack</li>
                    <li>A/B variants for Product Page tests</li>
                    <li>5 social ads, when they launch</li>
                  </ul>
                </div>
              </div>
              <Link className="btn" href="/packs/new" style={{ background: "var(--ink)", color: "#fff", minHeight: 54, padding: "0 30px", fontSize: 16 }}>Make free drafts</Link>
              {!CHECKOUT_LIVE && <p style={{ margin: "16px 0 0", fontSize: 14, fontWeight: 600 }}>Checkout opens soon. You can make and preview drafts today.</p>}
            </div>
          </div>
        </section>

        <section id="faq" className="wrap lp-sec">
          <div className="lp-head"><h2 className="disp lp-h2">Questions</h2></div>
          <div className="lp-faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <div className="wrap">
          <div>
            <span className="disp" style={{ fontSize: 26 }}>trailerly</span>
            <p className="mu" style={{ margin: "8px 0 0", fontSize: 14 }}>Marketing videos for indie iOS apps.</p>
          </div>
          <nav className="lp-fl" aria-label="Product">
            <b style={{ fontSize: 14 }}>Product</b>
            <a href="#pack">What&apos;s in a pack</a>
            <a href="#rules">Rules check</a>
            <a href="#compare">Compare</a>
            <a href="#explore">Examples</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <nav className="lp-fl" aria-label="Help">
            <b style={{ fontSize: 14 }}>Help</b>
            <a href="#how">How it works</a>
            <a href="#faq">FAQ</a>
          </nav>
          <nav className="lp-fl" aria-label="Account">
            <b style={{ fontSize: 14 }}>Account</b>
            <Link href="/login">Log in</Link>
            <Link href="/packs/new">Start a pack</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
