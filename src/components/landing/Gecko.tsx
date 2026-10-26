"use client";

import { useEffect, useRef } from "react";

// A small gecko that visits now and then. It scurries in from the side of the screen in short bursts,
// stops to look around, flicks its tail and blinks, then runs off. Hover over it or tap it and it bolts.
// Everything runs in one requestAnimationFrame loop that writes transforms straight to the SVG, so React
// never re-renders during a visit. Off with reduced motion. Add ?gecko to the URL to call it straight away.

type Pt = { x: number; y: number };
type Step = { kind: "move"; to: Pt; speed: number; flee?: boolean } | { kind: "look"; dur: number };

const r = (a: number, b: number) => a + Math.random() * (b - a);
const LEN = 84; // rendered width of the SVG in px (viewBox 100 x 60)
const STRIDE = 30; // px travelled per full leg cycle, so feet don't slide

/** Tapered tail outline from the hip (36,30) back along a bent centreline. */
function tailPath(bend: number, curl: number): string {
  const pts: Pt[] = [];
  for (let k = 0; k <= 8; k++) {
    const t = k / 8;
    const x = 36 - t * 34;
    const y = 30 + Math.sin(t * 2.2) * bend * 10 + t * t * curl * 10;
    pts.push({ x, y });
  }
  const left: string[] = [];
  const right: string[] = [];
  pts.forEach((p, k) => {
    const w = 3.8 * (1 - k / 9) + 0.4;
    const q = pts[Math.min(k + 1, 8)]!;
    const o = pts[Math.max(k - 1, 0)]!;
    const a = Math.atan2(q.y - o.y, q.x - o.x) + Math.PI / 2;
    left.push(`${(p.x + Math.cos(a) * w).toFixed(2)} ${(p.y + Math.sin(a) * w).toFixed(2)}`);
    right.unshift(`${(p.x - Math.cos(a) * w).toFixed(2)} ${(p.y - Math.sin(a) * w).toFixed(2)}`);
  });
  return `M ${left.join(" L ")} L ${right.join(" L ")} Z`;
}

export function Gecko() {
  const el = useRef<HTMLDivElement>(null);
  const flee = useRef<() => void>(() => {});

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const node = el.current;
    const layer = node?.parentElement;
    if (!node || !layer) return;
    const q = <T extends Element>(s: string) => node.querySelector(s) as T;
    const tail = q<SVGPathElement>(".tail");
    const head = q<SVGGElement>(".head");
    const eyes = Array.from(node.querySelectorAll<SVGEllipseElement>(".eye"));
    const legs = ["fl", "fr", "bl", "br"].map((c) => q<SVGGElement>(`.${c}`));
    const PIV = [[60, 25], [60, 35], [40, 25], [40, 35]] as const;

    let timer = 0;
    let raf = 0;
    let steps: Step[] = [];
    let pos: Pt = { x: 0, y: 0 };
    let heading = 0;
    let phase = 0;
    let dashing = true;
    let burst = 0;
    let lookLeft = 0;
    let headAng = 0;
    let headTarget = 0;
    let headNext = 0;
    let flick = 0;
    let blinkAt = 0;
    let last = 0;
    let t = 0;

    const width = () => layer.clientWidth;
    const scale = () => (width() < 640 ? 0.8 : 1);

    function plan(): Step[] {
      const W = width();
      const top = -layer!.getBoundingClientRect().top;
      const vh = window.innerHeight;
      const left = Math.random() < 0.5;
      const sx = left ? -1 : 1;
      const edge = left ? 0 : W;
      const y0 = top + vh * r(0.3, 0.75);
      pos = { x: edge + sx * 60, y: y0 };
      heading = left ? 0 : Math.PI;
      const reach = W < 640 ? r(40, 120) : r(70, Math.min(260, W * 0.22));
      const p1 = { x: edge - sx * reach, y: y0 + r(-70, 70) };
      const out: Step[] = [{ kind: "move", to: p1, speed: r(320, 420) }, { kind: "look", dur: r(1.8, 3.4) }];
      let end = p1;
      if (Math.random() < 0.55) {
        end = { x: p1.x - sx * r(20, 90), y: p1.y + r(-100, 100) };
        out.push({ kind: "move", to: end, speed: r(300, 400) }, { kind: "look", dur: r(1.2, 2.6) });
      }
      // Usually back out the way it came; sometimes a dash right across.
      const across = Math.random() < 0.25;
      const exitX = across ? W - edge + -sx * 80 : edge + sx * 80;
      out.push({ kind: "move", to: { x: exitX, y: end.y + r(-140, 140) }, speed: across ? 520 : 440 });
      return out;
    }

    function render() {
      const wob = dashing ? Math.sin(phase) * 0.07 : 0;
      const s = scale();
      node!.style.transform = `translate(${pos.x - LEN / 2}px, ${pos.y - (LEN * 0.6) / 2}px) rotate(${heading + wob}rad) scale(${s})`;
      const sw = Math.sin(phase) * 30;
      [sw, -sw, -sw, sw].forEach((a, k) => legs[k]!.setAttribute("transform", `rotate(${a.toFixed(1)} ${PIV[k]![0]} ${PIV[k]![1]})`));
      const bend = (dashing ? -Math.sin(phase - 0.6) * 0.5 : 0) + Math.sin(t * 28) * flick;
      tail.setAttribute("d", tailPath(bend, Math.sin(t * 0.9) * 0.25));
      head.setAttribute("transform", `rotate(${((headAng + (dashing ? Math.sin(phase) * -0.12 : 0)) * 57.3).toFixed(1)} 66 30)`);
      const ry = t < blinkAt + 0.12 && t > blinkAt ? 0.4 : 2.4;
      eyes.forEach((e) => e.setAttribute("ry", String(ry)));
    }

    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      t += dt;
      flick = Math.max(0, flick - dt * 1.6);
      const step = steps[0];
      if (!step) return finish();

      if (step.kind === "look") {
        dashing = false;
        if (lookLeft === 0) lookLeft = step.dur;
        lookLeft -= dt;
        if (t > headNext) {
          // Reptiles snap their head to a new angle and hold it.
          headTarget = r(-0.7, 0.7);
          headNext = t + r(0.35, 1.1);
          if (Math.random() < 0.18) heading += r(-0.5, 0.5);
          if (Math.random() < 0.3) flick = 0.5;
          if (Math.random() < 0.3) blinkAt = t;
        }
        if (lookLeft <= 0) {
          lookLeft = 0;
          headTarget = 0;
          steps.shift();
        }
      } else {
        const dx = step.to.x - pos.x;
        const dy = step.to.y - pos.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 6) {
          steps.shift();
        } else {
          burst -= dt;
          if (burst <= 0) {
            // Geckos move in dashes with tiny freezes in between.
            dashing = step.flee ? true : !dashing;
            burst = dashing ? r(0.25, 0.7) : r(0.1, 0.45);
          }
          if (dashing) {
            let diff = Math.atan2(dy, dx) - heading;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            heading += Math.sign(diff) * Math.min(Math.abs(diff), (step.flee ? 16 : 9) * dt);
            const v = step.speed * (Math.abs(diff) > 1 ? 0.35 : 1) * dt;
            const d = Math.min(v, dist);
            pos = { x: pos.x + Math.cos(heading) * d, y: pos.y + Math.sin(heading) * d };
            phase += (d / STRIDE) * Math.PI * 2;
            headTarget = 0;
          }
        }
      }
      headAng += (headTarget - headAng) * Math.min(1, dt * 22);
      render();
      raf = requestAnimationFrame(frame);
    }

    function finish() {
      node!.style.display = "none";
      steps = [];
      timer = window.setTimeout(visit, r(35000, 70000));
    }

    function visit() {
      if (document.hidden) {
        timer = window.setTimeout(visit, 10000);
        return;
      }
      steps = plan();
      dashing = true;
      burst = r(0.3, 0.6);
      lookLeft = 0;
      headAng = headTarget = 0;
      blinkAt = -1;
      node!.style.display = "block";
      last = performance.now();
      render();
      raf = requestAnimationFrame(frame);
    }

    flee.current = () => {
      if (!steps.length || (steps[0]?.kind === "move" && steps[0].flee)) return;
      const W = width();
      const toLeft = pos.x < W / 2;
      steps = [{ kind: "move", to: { x: toLeft ? -90 : W + 90, y: pos.y + r(-120, 120) }, speed: 1000, flee: true }];
      dashing = true;
      flick = 0.8;
      lookLeft = 0;
    };

    const first = new URLSearchParams(window.location.search).has("gecko") ? 400 : r(8000, 14000);
    timer = window.setTimeout(visit, first);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Leg paths (heading right) and toe offsets from each foot, fanned forward on the front feet and back on the hind feet.
  const legPaths = [
    { c: "fl", d: "M60 25 L63 16 L69 13", f: [69, 13], toes: [[2.6, -1.2], [0.8, -2.8], [-1.6, -2.4]] },
    { c: "fr", d: "M60 35 L63 44 L69 47", f: [69, 47], toes: [[2.6, 1.2], [0.8, 2.8], [-1.6, 2.4]] },
    { c: "bl", d: "M40 25 L39 16 L33 12", f: [33, 12], toes: [[-2.6, -1.2], [-0.8, -2.8], [1.6, -2.4]] },
    { c: "br", d: "M40 35 L39 44 L33 48", f: [33, 48], toes: [[-2.6, 1.2], [-0.8, 2.8], [1.6, 2.4]] },
  ] as const;

  return (
    <div className="lp-gecko-layer" aria-hidden="true">
      <div ref={el} className="lp-gecko" onPointerEnter={() => flee.current()} onPointerDown={() => flee.current()}>
        <svg viewBox="0 0 100 60" width={LEN} height={LEN * 0.6}>
          <path className="tail" fill="#B8F23A" d={tailPath(0, 0)} />
          {legPaths.map((l) => (
            <g key={l.c} className={l.c}>
              <path d={l.d} fill="none" stroke="#B8F23A" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
              {l.toes.map(([x, y], k) => (
                <circle key={k} cx={l.f[0] + x} cy={l.f[1] + y} r="1.5" fill="#B8F23A" />
              ))}
            </g>
          ))}
          <ellipse cx="50" cy="30" rx="17" ry="7.5" fill="#B8F23A" />
          <path d="M36 30 H62" stroke="#FFE135" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
          {[[42, 26.5], [48, 33.5], [54, 26.5], [58, 33]].map(([x, y], k) => (
            <circle key={k} cx={x} cy={y} r="1.5" fill="#2EE6A6" />
          ))}
          <g className="head">
            <path d="M63 24.5 Q75 22 81 26.5 Q85 30 81 33.5 Q75 38 63 35.5 Z" fill="#B8F23A" />
            <ellipse className="eye" cx="73.5" cy="24.8" rx="2.4" ry="2.4" fill="#0A0A0E" />
            <ellipse className="eye" cx="73.5" cy="35.2" rx="2.4" ry="2.4" fill="#0A0A0E" />
            <circle cx="74.3" cy="24.1" r="0.7" fill="#fff" />
            <circle cx="74.3" cy="34.5" r="0.7" fill="#fff" />
          </g>
        </svg>
      </div>
    </div>
  );
}
