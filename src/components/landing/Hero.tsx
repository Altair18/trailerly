"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SideReels } from "./SideReels";

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
    aura: ["#FF2E88", "#9D7BFF", "#FF7A1A"],
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
    aura: ["#38D9FF", "#2EE6A6", "#9D7BFF"],
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
    aura: ["#FF7A1A", "#FFE135", "#FF5A4E"],
  },
];

const AUTO_MS = 5000;
// After someone picks a slide themselves, give them longer to read it before moving on.
const MANUAL_MS = 12000;
const SWIPE_PX = 40;

/**
 * Auto-advancing hero. Change slides with the arrows, the labelled tabs, a swipe or drag, or the left and right arrow keys.
 * Pauses on hover or focus and when motion is reduced.
 */
export function Hero() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [manual, setManual] = useState(false);
  const drag = useRef<{ x: number; y: number; id: number } | null>(null);
  const dragged = useRef(false);
  const n = SLIDES.length;

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => {
      setManual(false);
      setI((k) => (k + 1) % n);
    }, manual ? MANUAL_MS : AUTO_MS);
    return () => clearTimeout(t);
  }, [i, paused, manual, n]);

  const go = (k: number) => {
    setManual(true);
    setI(((k % n) + n) % n);
  };

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    dragged.current = false;
  }
  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    dragged.current = true;
    go(dx < 0 ? i + 1 : i - 1);
  }
  // Hover tilt: mouse only, eased toward the pointer each frame, and back to flat on leave.
  const tilt = useRef<HTMLDivElement>(null);
  const tiltTarget = useRef({ x: 0, y: 0, on: 0 });
  const tiltNow = useRef({ x: 0, y: 0, on: 0 });
  const tiltRaf = useRef(0);
  function tiltStep() {
    const el = tilt.current;
    if (!el) return;
    const t = tiltTarget.current;
    const c = tiltNow.current;
    c.x += (t.x - c.x) * 0.12;
    c.y += (t.y - c.y) * 0.12;
    c.on += (t.on - c.on) * 0.12;
    el.style.setProperty("--tx", c.x.toFixed(4));
    el.style.setProperty("--ty", c.y.toFixed(4));
    el.style.setProperty("--glare", c.on.toFixed(3));
    const settled = Math.abs(t.x - c.x) + Math.abs(t.y - c.y) + Math.abs(t.on - c.on) < 0.001;
    tiltRaf.current = settled ? 0 : requestAnimationFrame(tiltStep);
  }
  function kickTilt() {
    if (!tiltRaf.current) tiltRaf.current = requestAnimationFrame(tiltStep);
  }
  function onTiltMove(e: React.PointerEvent) {
    if (e.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    // -0.5..0.5 across the card.
    tiltTarget.current = { x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5, on: 1 };
    kickTilt();
  }
  function onTiltLeave() {
    tiltTarget.current = { x: 0, y: 0, on: 0 };
    kickTilt();
  }
  useEffect(() => () => cancelAnimationFrame(tiltRaf.current), []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "ArrowRight") go(i + 1);
    else if (e.key === "ArrowLeft") go(i - 1);
    else return;
    e.preventDefault();
  }

  const s = SLIDES[i]!;
  return (
    <section
      id="top"
      className="wrap lp-hero-wrap"
      style={{ paddingTop: 20 }}
      aria-roledescription="carousel"
      aria-label="What Trailerly makes"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={onKeyDown}
    >
      {/* Glow that spills out of the hero into the black; one layer per slide so they cross-fade. */}
      <div className="lp-aura" aria-hidden="true">
        {SLIDES.map((sl, k) => (
          <div key={sl.tag} className={k === i ? "on" : undefined}>
            {sl.aura.map((c, n) => <i key={n} style={{ background: c }} />)}
          </div>
        ))}
      </div>
      <SideReels />
      {/* Spotify-style hover: the card tilts toward the pointer, with a soft glare that follows it. */}
      <div ref={tilt} className="lp-tilt" onPointerMove={onTiltMove} onPointerLeave={onTiltLeave}>
        <div
          key={i}
          className="lp-tile lp-hero lp-fade"
          aria-live={paused || manual ? "polite" : "off"}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (drag.current = null)}
          // A drag that ends on the CTA should change slide, not follow the link.
          onClickCapture={(e) => {
            if (dragged.current) {
              e.preventDefault();
              e.stopPropagation();
              dragged.current = false;
            }
          }}
          onDragStart={(e) => e.preventDefault()}
        >
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
        <div className="lp-glare" aria-hidden="true" />
      </div>
      <div className="lp-ctrl">
        <button type="button" className="lp-arrow" aria-label="Previous slide" onClick={() => go(i - 1)}>
          <Chevron dir="left" />
        </button>
        <div className="lp-dots" role="group" aria-label="Choose slide">
          {SLIDES.map((sl, k) => (
            <button
              key={sl.tag}
              type="button"
              className={`lp-dot${k === i ? " on" : k < i ? " past" : ""}${paused ? " paused" : ""}`}
              style={{ "--dur": `${manual ? MANUAL_MS : AUTO_MS}ms` } as React.CSSProperties}
              aria-label={`Show slide ${k + 1}: ${sl.title}`}
              aria-current={k === i ? "true" : undefined}
              onClick={() => go(k)}
            >
              <b>{sl.tag}</b>
              <span className="bar"><span key={k === i ? `${i}-${manual}` : undefined} /></span>
            </button>
          ))}
        </div>
        <button type="button" className="lp-arrow" aria-label="Next slide" onClick={() => go(i + 1)}>
          <Chevron dir="right" />
        </button>
      </div>
    </section>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
    </svg>
  );
}
