import Link from "next/link";
import { ExampleGrid } from "@/components/landing/ExampleGrid";
import { Hero } from "@/components/landing/Hero";
import { LinkBar } from "@/components/landing/LinkBar";
import { Play } from "@/components/landing/Play";
import { Logo } from "@/components/TopBar";
import "./landing.css";

// Landing page, built from the approved option B frame. Social ads and checkout are not live yet, so they say "coming soon".

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
  { t: "Download the pack", d: "Full-size files, named for where each one goes in App Store Connect.", c: "var(--purple)" },
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
    a: "Drafts are free to preview. A full pack is a one-off payment, with no subscription. Checkout is being set up now, so paid downloads open soon.",
  },
  {
    q: "What happens to my reviews and recording?",
    a: "Reviews are used to write hooks; reviewer names are never kept. Your recording is only used to make your pack.",
  },
];

export default function Home() {
  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <Logo />
          <nav aria-label="Main" className="lp-nav">
            <a className="lp-nl" href="#explore">Examples</a>
            <a className="lp-nl" href="#pack">What&apos;s in a pack</a>
            <a className="lp-nl" href="#rules">Rules check <span className="lp-new">New</span></a>
            <a className="lp-nl" href="#how">How it works</a>
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

        <section id="pack" className="wrap lp-sec">
          <div className="lp-head">
            <div>
              <h2 className="disp lp-h2">Every slot. One recording.</h2>
              <p className="mu">Each video is cut from your recording and sized for where it runs.</p>
            </div>
            <Link className="btn btn-ghost" href="/packs/new">Start a pack</Link>
          </div>
          <div className="lp-mosaic">
            <div className="lp-tile tall" style={{ gridColumn: "span 3", gridRow: "span 4" }}>
              <div className="kb flow" style={{ backgroundImage: "linear-gradient(160deg,#FF2E88,#9D7BFF,#FF7A1A)" }} />
              <Play />
              <div className="lp-shade" />
              <div className="lp-cap"><b>App Store preview</b><div className="mono">886×1920 · screen capture only</div></div>
            </div>
            <div className="lp-tile lp-bars wide" style={{ gridColumn: "span 9", gridRow: "span 2" }}>
              <div className="kb flow" style={{ backgroundImage: "linear-gradient(110deg,#38D9FF,#2EE6A6,#B8F23A)" }} />
              <div style={{ position: "absolute", left: 0, right: 0, top: "50%", transform: "translateY(-50%)", zIndex: 2, textAlign: "center", padding: "0 24px" }}>
                <span className="disp" style={{ fontSize: "clamp(32px, 4.5vw, 54px)", color: "var(--ink)" }}>Stop guessing when to water</span>
              </div>
              <Play />
              <div className="lp-cap" style={{ textAlign: "right" }}><span className="lp-badge">Header · 21:9 loop · iOS 27</span></div>
            </div>
            <div className="lp-tile" style={{ gridColumn: "span 3", gridRow: "span 2" }}>
              <div className="kb flow" style={{ backgroundImage: "linear-gradient(140deg,#FFE135,#FF7A1A)" }} />
              <Play />
              <div className="lp-shade" />
              <div className="lp-cap"><b>Search video</b><div className="mono">3:2 · works muted</div></div>
            </div>
            <div className="lp-tile" style={{ gridColumn: "span 3", gridRow: "span 2" }}>
              <div className="kb flow" style={{ backgroundImage: "linear-gradient(140deg,#9D7BFF,#38D9FF)" }} />
              <div className="lp-shade" />
              <div className="lp-cap"><b>Stills</b><div className="mono">header · search · universal</div></div>
            </div>
            <div className="lp-tile" style={{ gridColumn: "span 3", gridRow: "span 2" }}>
              <div className="kb flow" style={{ backgroundImage: "linear-gradient(180deg,#FF5A4E,#FFE135)" }} />
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, zIndex: 2 }} aria-hidden="true">
                {["A", "B", "C"].map((l) => (
                  <span key={l} className="disp" style={{ width: 52, height: 52, borderRadius: 14, background: "var(--ink)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>{l}</span>
                ))}
              </div>
              <div className="lp-shade" />
              <div className="lp-cap"><b>A/B variants</b><div className="mono">for Product Page tests</div></div>
            </div>
          </div>
          <div className="lp-tile" style={{ marginTop: 14, padding: "20px 22px", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", border: "1px dashed #3a3a46" }}>
            <span className="lp-soon">Coming soon</span>
            <b>5 social ads for TikTok, Reels and Shorts</b>
            <span className="mu">Vertical, with voice and captions, from the same recording.</span>
          </div>
        </section>

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
            <div style={{ position: "relative", zIndex: 2, padding: "56px 24px", color: "var(--ink)" }}>
              <p className="mono" style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, letterSpacing: ".14em", textTransform: "uppercase" }}>One pack, paid once</p>
              <h2 className="disp" style={{ margin: "0 0 10px", fontSize: "clamp(64px, 10vw, 96px)" }}>£19 per pack</h2>
              <p style={{ margin: "0 0 18px", fontSize: 18, fontWeight: 600 }}>No subscription. Full size, no watermark. Drafts are free to preview.</p>
              <ul>
                <li>App Store preview</li>
                <li>Header + search videos</li>
                <li>3 stills</li>
                <li>A/B variants</li>
                <li>Rules report</li>
              </ul>
              <Link className="btn" href="/packs/new" style={{ background: "var(--ink)", color: "#fff", minHeight: 54, padding: "0 30px", fontSize: 16 }}>Start a pack</Link>
              <p style={{ margin: "16px 0 0", fontSize: 14, fontWeight: 600 }}>Checkout opens soon. You can make and preview drafts today.</p>
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
