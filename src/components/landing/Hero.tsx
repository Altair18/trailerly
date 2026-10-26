"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const SLIDES = [
  {
    tag: "Now showing",
    title: "A trailer for your app",
    sub: "One App Store link and one screen recording become App Store videos sized for every slot, each checked against Apple's rules.",
    cta: "Make my pack",
    bg: "linear-gradient(120deg,#FF2E88,#9D7BFF,#FF7A1A)",
    screen: "#FFE135",
    side: "#38D9FF",
    hook: "Stop guessing when to water",
    tagBg: "#FFE135",
  },
  {
    tag: "iOS 27 ready",
    title: "Header and search videos",
    sub: "Apple's new 21:9 header and 3:2 search videos, plus matching stills, with your text kept inside every device crop.",
    cta: "Start with my link",
    bg: "linear-gradient(120deg,#38D9FF,#2EE6A6,#9D7BFF)",
    screen: "#B8F23A",
    side: "#FF2E88",
    hook: "Every plant, one reminder",
    tagBg: "#B8F23A",
  },
  {
    tag: "A/B ready",
    title: "Hooks written from your reviews",
    sub: "Pick a headline from 10 hooks mined from what users already say. Extra picks become B and C variants to test.",
    cta: "Write my hooks",
    bg: "linear-gradient(120deg,#FF7A1A,#FFE135,#FF5A4E)",
    screen: "#9D7BFF",
    side: "#2EE6A6",
    hook: "POV: your plants outlive your goldfish",
    tagBg: "#38D9FF",
  },
];

/** Auto-advancing hero, one slide every 5 s; pauses on hover or focus and when motion is reduced. */
export function Hero() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setI((n) => (n + 1) % SLIDES.length), 5000);
    return () => clearTimeout(t);
  }, [i, paused]);

  const s = SLIDES[i]!;
  return (
    <section
      id="top"
      className="wrap"
      style={{ paddingTop: 20 }}
      aria-roledescription="carousel"
      aria-label="What Trailerly makes"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div key={i} className="lp-tile lp-hero lp-fade" aria-live={paused ? "polite" : "off"}>
        <div className="kb flow" style={{ backgroundImage: s.bg }} />
        <div className="lp-phones" aria-hidden="true">
          <div className="lp-phone bob">
            <div style={{ background: s.screen }}><span className="disp">{s.hook}</span></div>
          </div>
          <div className="lp-side bob" style={{ background: s.side, animationDelay: "-1.5s" }} />
        </div>
        <div className="lp-shade" style={{ height: "100%", background: "linear-gradient(90deg,rgba(0,0,0,.72),rgba(0,0,0,0) 65%)" }} />
        <div className="lp-hero-copy">
          <span className="lp-tag" style={{ background: s.tagBg }}>{s.tag}</span>
          <h1 className="disp">{s.title}</h1>
          <p>{s.sub}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="btn btn-primary" href="/packs/new" style={{ minHeight: 52, fontSize: 16 }}>{s.cta}</Link>
            <a className="btn btn-ghost" href="#explore" style={{ minHeight: 52, fontSize: 16, backdropFilter: "blur(8px)" }}>See examples</a>
          </div>
        </div>
      </div>
      <div className="lp-dots" role="group" aria-label="Choose slide">
        {SLIDES.map((sl, k) => (
          <button
            key={sl.tag}
            type="button"
            className={`lp-dot${k === i ? " on" : k < i ? " past" : ""}${paused ? " paused" : ""}`}
            aria-label={`Show slide ${k + 1}: ${sl.title}`}
            aria-current={k === i ? "true" : undefined}
            onClick={() => setI(k)}
          >
            <span />
          </button>
        ))}
      </div>
    </section>
  );
}
