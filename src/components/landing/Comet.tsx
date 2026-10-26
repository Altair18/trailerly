"use client";

import { useEffect, useRef, useState } from "react";

// The logo flies across the top of the page every so often, trailing a rainbow film strip.
// The first flight loops around the hero; later ones are random swoops. Off with reduced motion.

const EVERY_MS = 20000;
const H = 1000; // height of the band it flies in, from the top of the page content

function swoop(w: number, first: boolean): string {
  const r = (a: number, b: number) => a + Math.random() * (b - a);
  if (first) {
    // In from the left under the hero, up the right gutter, one loop, out over the top left.
    return `M -80 ${H * 0.72} C ${w * 0.35} ${H * 0.95}, ${w * 0.9} ${H * 0.8}, ${w * 0.93} ${H * 0.45} ` +
      `S ${w * 0.8} ${H * 0.05}, ${w * 0.86} ${H * 0.22} S ${w * 0.99} ${H * 0.4}, ${w * 0.7} ${H * 0.12} ` +
      `S ${w * 0.2} ${H * 0.02}, -80 ${H * 0.18}`;
  }
  const ltr = Math.random() < 0.5;
  const [x0, x1] = ltr ? [-80, w + 80] : [w + 80, -80];
  const y0 = r(0.1, 0.9) * H, y1 = r(0.1, 0.9) * H;
  return `M ${x0} ${y0} C ${w * r(0.2, 0.4)} ${r(-0.1, 1.1) * H}, ${w * r(0.6, 0.8)} ${r(-0.1, 1.1) * H}, ${x1} ${y1}`;
}

export function Comet() {
  const [flight, setFlight] = useState<{ d: string; w: number; n: number } | null>(null);
  const n = useRef(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const fly = () => {
      const w = document.documentElement.clientWidth;
      setFlight({ d: swoop(w, n.current === 0), w, n: n.current++ });
    };
    const start = setTimeout(fly, 1200);
    const t = setInterval(fly, EVERY_MS);
    return () => { clearTimeout(start); clearInterval(t); };
  }, []);

  if (!flight) return null;
  const long = flight.n === 0;
  return (
    <div key={flight.n} className={`lp-comet${long ? " long" : ""}`} aria-hidden="true">
      <svg width={flight.w} height={H} viewBox={`0 0 ${flight.w} ${H}`}>
        <defs>
          <linearGradient id="lp-comet-g" x1="0" x2={flight.w} y1="0" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FF2E88" />
            <stop offset=".25" stopColor="#FFE135" />
            <stop offset=".5" stopColor="#38D9FF" />
            <stop offset=".75" stopColor="#B8F23A" />
            <stop offset="1" stopColor="#9D7BFF" />
          </linearGradient>
          <mask id="lp-comet-m" maskUnits="userSpaceOnUse" x="-200" y="-200" width={flight.w + 400} height={H + 400}>
            <path className="trail mask" d={flight.d} pathLength={1000} />
          </mask>
        </defs>
        <path className="trail strip" d={flight.d} pathLength={1000} />
        {/* Sprocket holes along the whole path, shown only where the trail is. */}
        <path className="holes" d={flight.d} pathLength={1000} mask="url(#lp-comet-m)" />
      </svg>
      <span className="lp-comet-head" style={{ offsetPath: `path("${flight.d}")` }}>
        <svg width="12" height="12" viewBox="0 0 24 24"><path d="M6 3v18l15-9z" fill="#0A0A0E" /></svg>
      </span>
    </div>
  );
}
