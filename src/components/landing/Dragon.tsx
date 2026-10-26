"use client";

import { useEffect, useRef } from "react";

// A bearded dragon that visits now and then. It walks in from the side, climbs onto a card you can see
// (or a quiet bit of the page), turns, and lies flat to bask: eyes half shut, the odd head bob with its
// beard puffed dark, and now and then a slow arm wave. After a while it wanders off. Hover or tap and it bolts.
//
// It is animated procedurally:
// - the head steers and the spine follows as a chain of joints with limited bend, so the body and tail
//   curve on their own;
// - each foot stays planted until the body pulls too far ahead, then steps, in diagonal pairs, with
//   two-bone IK for elbows and knees.
// Everything is drawn in one rAF loop writing SVG paths, so React never re-renders during a visit.
// Off with reduced motion. Add ?dragon to the URL to call it straight away.

type V = { x: number; y: number };
type Step =
  | { kind: "move"; to: V; speed: number; flee?: boolean }
  | { kind: "look"; dur: number }
  | { kind: "rest"; dur: number };
type Foot = { pos: V; from: V; to: V; t: number };

const r = (a: number, b: number) => a + Math.random() * (b - a);
const add = (a: V, b: V, k = 1): V => ({ x: a.x + b.x * k, y: a.y + b.y * k });
const sub = (a: V, b: V): V => ({ x: a.x - b.x, y: a.y - b.y });
const len = (a: V) => Math.hypot(a.x, a.y);
const unit = (a: V): V => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
};
const rot = (a: V, t: number): V => ({ x: a.x * Math.cos(t) - a.y * Math.sin(t), y: a.x * Math.sin(t) + a.y * Math.cos(t) });
const lerp = (a: V, b: V, t: number): V => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const ang = (a: V) => Math.atan2(a.y, a.x);
const wrap = (t: number) => Math.atan2(Math.sin(t), Math.cos(t));
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const f1 = (n: number) => n.toFixed(1);
const mix = (a: string, b: string, t: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i]! - v) * t)).join(",")})`;
};

// Spine: 26 joints, snout to tail tip. Wide spade head, broad flat body, long thin tail.
const N = 26;
const SEG = 5.2;
const HW = [2.4, 5.4, 7.6, 8.4, 6.2, 7.6, 10.0, 11.4, 12.0, 12.0, 11.6, 10.6, 8.8, 6.4, 5.4, 4.7, 4.1, 3.6, 3.1, 2.7, 2.3, 1.9, 1.5, 1.1, 0.8, 0.5];
// Most a joint may bend relative to the one in front (radians): stiff body, loose tail.
const BEND = [0, 0, 0.1, 0.18, 0.26, 0.18, 0.1, 0.08, 0.08, 0.08, 0.1, 0.12, 0.18, 0.24, 0.28, 0.3, 0.3, 0.32, 0.32, 0.34, 0.34, 0.36, 0.36, 0.38, 0.38, 0.38];
const FRONT = 6;
const HIND = 12;
const LIMB = 10;
const VIEW = 600; // size of the moving SVG window around the dragon

// Back pattern, fixed so it never shimmers: [joint + fraction, offset across the body -1..1, radius].
const BLOTCHES: [number, number, number][] = (() => {
  let seed = 11;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const out: [number, number, number][] = [];
  for (let j = 5.6; j < 12.6; j += 1.1) for (const s of [1, -1]) out.push([j + rnd() * 0.3, s * (0.42 + rnd() * 0.12), 1.7 + rnd() * 0.8]);
  for (let k = 0; k < 26; k++) out.push([2 + rnd() * 10.5, (rnd() * 2 - 1) * 0.8, 0.5 + rnd() * 0.5]);
  return out;
})();

const C = {
  body: "#D9A15A",
  head: "#E7A14C",
  limb: "#D49A55",
  edge: "#7A4E22",
  pattern: "#8E5A2A",
  ridge: "#F4D3A0",
  spike: "#C48743",
  beard: "#8A5A2B",
  beardDark: "#22140A",
  eye: "#1A120A",
};

function circle(p: V, rad: number) {
  const a = rad.toFixed(2);
  const d = (rad * 2).toFixed(2);
  return `M${f1(p.x - rad)} ${f1(p.y)}a${a} ${a} 0 1 0 ${d} 0a${a} ${a} 0 1 0 -${d} 0`;
}

/** Closed Catmull-Rom spline through the points, as cubic Béziers. */
function smooth(pts: V[]) {
  const n = pts.length;
  let d = `M${f1(pts[0]!.x)} ${f1(pts[0]!.y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]!, p1 = pts[i]!, p2 = pts[(i + 1) % n]!, p3 = pts[(i + 2) % n]!;
    const c1 = add(p1, sub(p2, p0), 1 / 6);
    const c2 = add(p2, sub(p3, p1), -1 / 6);
    d += `C${f1(c1.x)} ${f1(c1.y)} ${f1(c2.x)} ${f1(c2.y)} ${f1(p2.x)} ${f1(p2.y)}`;
  }
  return d + "Z";
}

/** Forward direction and left normal at joint i, from its neighbours. */
function frameAt(q: V[], i: number) {
  const f = unit(sub(q[Math.max(0, i - 1)]!, q[Math.min(N - 1, i + 1)]!));
  return { f, n: { x: f.y, y: -f.x } };
}

/** A visible card to bask on, as a point inside it (layer coordinates), or null. */
function cardSpot(layer: HTMLElement, S: number): V | null {
  const lr = layer.getBoundingClientRect();
  const vh = window.innerHeight;
  const cards = Array.from(document.querySelectorAll<HTMLElement>(".lp-tile, .lp-linkbar, .lp-tier, .lp-cmp, .lp-steps > li"))
    .map((e) => e.getBoundingClientRect())
    .filter((c) => c.width > 240 && c.height > 120 && c.bottom > 200 && c.top < vh - 160);
  if (!cards.length) return null;
  const c = cards[Math.floor(Math.random() * cards.length)]!;
  // Wide screens: the card's right-hand side, where the copy usually isn't. Phones: low on the card, under the buttons.
  const phone = window.innerWidth < 640;
  const y = clamp(c.top + c.height * (phone ? r(0.8, 0.9) : r(0.2, 0.45)), Math.max(c.top + 50 * S, 140), Math.min(c.bottom - 40 * S, vh - 120));
  if (y < c.top || y > c.bottom) return null;
  const x = c.left + c.width * (phone ? r(0.5, 0.7) : r(0.62, 0.84));
  return { x: x - lr.left, y: y - lr.top };
}

export function Dragon() {
  const el = useRef<HTMLDivElement>(null);
  const flee = useRef<() => void>(() => {});

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const node = el.current;
    const layer = node?.parentElement;
    if (!node || !layer) return;
    const $ = (c: string) => node.querySelector(`.${c}`) as SVGElement;
    const parts = {
      limbs: [0, 1, 2, 3].map((k) => $(`limb${k}`)),
      claws: $("claws"),
      spikes: $("spikes"),
      beard: $("beard"),
      body: $("body"),
      head: $("headtint"),
      ridge: $("ridge"),
      pattern: $("pattern"),
      bands: $("bands"),
      eyes: $("eyes"),
      glint: $("glint"),
      nose: $("nose"),
      hit: $("hit"),
    };

    let S = 2;
    let timer = 0;
    let raf = 0;
    let steps: Step[] = [];
    let p: V[] = [];
    let feet: Foot[] = [];
    let heading = 0;
    let phase = 0;
    let walking = true;
    let burst = 0;
    let stepLeft = 0;
    let yaw = 0;
    let yawTarget = 0;
    let nextGlance = 0;
    let speedNow = 0;
    let idle = 0;
    let flat = 0; // 0 standing, 1 lying flat to bask
    let sleep = 0; // how far the eyes are closed
    let puff = 0; // beard puffed and dark
    let bobAt = -9;
    let nextBob = 0;
    let waveAt = -9;
    let waveLeg = 0;
    let nextWave = 0;
    let blinkAt = -9;
    let curl = 1; // which way the tail curls round when it lies down
    let last = 0;
    let t = 0;

    const W = () => layer.clientWidth;
    const bodyLen = () => N * SEG * S;

    // Legs: 0 front-left, 1 front-right, 2 hind-left, 3 hind-right. Diagonal pairs step together: {0,3} and {1,2}.
    const legIdx = (k: number) => (k < 2 ? FRONT : HIND);
    const legSide = (k: number) => (k % 2 === 0 ? 1 : -1);
    const widthAt = (i: number) => HW[i]! * S * (1 + flat * 0.16);
    function anchor(k: number, q = p) {
      const i = legIdx(k);
      return add(q[i]!, frameAt(q, i).n, legSide(k) * widthAt(i) * 0.6);
    }
    function rest(k: number) {
      const { f, n } = frameAt(p, legIdx(k));
      return add(add(anchor(k), f, (k < 2 ? 7 : -5) * S), n, legSide(k) * (14 + flat * 3) * S);
    }

    function plan(): Step[] {
      const w = W();
      S = w < 640 ? 1.4 : 2;
      const top = -layer!.getBoundingClientRect().top;
      const vh = window.innerHeight;
      // Bask on a card when one is in view, otherwise on the page near the right edge.
      const target = cardSpot(layer!, S) ?? { x: w - r(0.25, 0.4) * Math.min(w, 900), y: top + vh * r(0.4, 0.7) };
      const left = target.x < w / 2;
      const sx = left ? -1 : 1;
      const edge = left ? 0 : w;
      const y0 = clamp(target.y + r(-120, 120), top + 120, top + vh - 80);
      heading = left ? 0 : Math.PI;
      const head = { x: edge + sx * 20, y: y0 };
      p = Array.from({ length: N }, (_, i) => ({ x: head.x + sx * i * SEG * S, y: head.y }));
      feet = [0, 1, 2, 3].map((k) => {
        const at = rest(k);
        return { pos: at, from: at, to: at, t: -1 };
      });
      // Settle facing roughly into the page, so the tail trails back toward the edge it came from.
      const face = { x: -sx, y: r(-0.6, 0.6) };
      const settle = add(target, unit(face), 34 * S);
      const out: Step[] = [
        { kind: "move", to: target, speed: r(110, 150) * S },
        { kind: "look", dur: r(1, 2) },
        { kind: "move", to: settle, speed: 70 * S },
        { kind: "rest", dur: r(16, 28) },
        { kind: "look", dur: r(1, 2) },
      ];
      const exitX = left ? -bodyLen() - 60 : w + bodyLen() + 60;
      out.push({ kind: "move", to: { x: exitX, y: settle.y + r(-140, 140) }, speed: r(140, 180) * S });
      return out;
    }

    function follow() {
      for (let i = 1; i < N; i++) {
        let a = ang(sub(p[i]!, p[i - 1]!));
        if (i >= 2) {
          const prev = ang(sub(p[i - 1]!, p[i - 2]!));
          const d = wrap(a - prev);
          if (Math.abs(d) > BEND[i]!) a = prev + Math.sign(d) * BEND[i]!;
        }
        p[i] = add(p[i - 1]!, { x: Math.cos(a), y: Math.sin(a) }, SEG * S);
      }
    }

    function stepFeet(dt: number, moving: boolean) {
      const inA = (k: number) => k === 0 || k === 3;
      const otherPairStepping = (k: number) => feet.some((ft, j) => ft.t >= 0 && inA(j) !== inA(k));
      const dir = { x: Math.cos(heading), y: Math.sin(heading) };
      feet.forEach((ft, k) => {
        if (t < waveAt + 2.2 && k === waveLeg) return; // that hand is busy waving
        if (ft.t >= 0) {
          ft.t += dt / clamp((12 * S) / Math.max(1, speedNow), 0.07, 0.16);
          if (ft.t >= 1) {
            ft.t = -1;
            ft.pos = ft.to;
          } else ft.pos = lerp(ft.from, ft.to, ft.t);
          return;
        }
        const target = rest(k);
        const off = len(sub(ft.pos, target));
        // While walking, step when the foot falls behind; once still for a moment, tidy feet under the body.
        const limit = (moving ? 12 : idle > 0.25 ? 2.5 : 99) * S;
        if (off > limit && (!otherPairStepping(k) || off > limit * 2.2)) {
          ft.from = ft.pos;
          ft.to = moving ? add(target, dir, 8 * S) : target;
          ft.t = 0;
        }
      });
    }

    function render() {
      // Rendering-only offsets: head glance, head bob (head nears the viewer, so it grows), tail sway.
      const q = p.map((v) => ({ ...v }));
      const sinceBob = t - bobAt;
      const bob = sinceBob > 0 && sinceBob < 1.3 ? Math.abs(Math.sin(sinceBob * Math.PI * 2.4)) : 0;
      for (let i = 0; i < 4; i++) q[i] = add(p[4]!, rot(sub(p[i]!, p[4]!), yaw), 1 + bob * 0.09);
      let acc = 0;
      for (let i = 14; i < N; i++) {
        acc += Math.sin(t * 0.9 - (i - 14) * 0.5) * 0.02 * (walking ? 0 : 1) + flat * curl * 0.075;
        q[i] = add(q[i - 1]!, rot(sub(p[i]!, p[i - 1]!), acc));
      }

      const c = q[9]!;
      const o = (v: V) => ({ x: v.x - c.x + VIEW / 2, y: v.y - c.y + VIEW / 2 });
      node!.style.transform = `translate(${f1(c.x - VIEW / 2)}px, ${f1(c.y - VIEW / 2)}px)`;

      // Legs and claws, drawn under the body.
      let claws = "";
      feet.forEach((ft, k) => {
        const a = anchor(k, q);
        const u = LIMB * S;
        let lift = ft.t >= 0 ? Math.sin(ft.t * Math.PI) : 0;
        let target = ft.pos;
        const sinceWave = t - waveAt;
        if (k === waveLeg && sinceWave > 0 && sinceWave < 2.2) {
          // The bearded dragon wave: the hand lifts and circles slowly, then goes back down.
          const { f, n } = frameAt(q, FRONT);
          const up = Math.sin(Math.min(1, sinceWave / 2.2) * Math.PI);
          const centre = add(add(a, n, legSide(k) * 12 * S), f, 6 * S);
          const sw = sinceWave * Math.PI * 2 * 1.1;
          target = add(add(centre, f, Math.cos(sw) * 4 * S * up), n, legSide(k) * Math.sin(sw) * 3 * S * up);
          lift = up;
          ft.pos = target;
        }
        const raw = sub(target, a);
        const foot = len(raw) > 2 * u - 0.1 ? add(a, unit(raw), 2 * u - 0.1) : target;
        const d = clamp(len(sub(foot, a)), 2, 2 * u - 0.1);
        const th = ang(sub(foot, a));
        const al = Math.acos(clamp(d / (2 * u), -1, 1));
        const { f } = frameAt(q, legIdx(k));
        const e1 = add(a, { x: Math.cos(th + al), y: Math.sin(th + al) }, u);
        const e2 = add(a, { x: Math.cos(th - al), y: Math.sin(th - al) }, u);
        const dot = (e: V) => (e.x - a.x) * f.x + (e.y - a.y) * f.y;
        // Front elbows point back, hind knees point forward, as in real lizards.
        const elbow = k < 2 ? (dot(e1) < dot(e2) ? e1 : e2) : dot(e1) > dot(e2) ? e1 : e2;
        const A = o(a);
        const E = o(elbow);
        const F = o(foot);
        parts.limbs[k]!.setAttribute("d", `M${f1(A.x)} ${f1(A.y)}L${f1(E.x)} ${f1(E.y)}L${f1(F.x)} ${f1(F.y)}`);
        parts.limbs[k]!.setAttribute("stroke-width", ((5.2 + lift * 0.9) * S).toFixed(2));
        const fd = unit(sub(foot, elbow));
        [-1.0, -0.5, 0, 0.5, 0.95].forEach((sp, m) => {
          const tl = [2.6, 3.6, 4.2, 3.7, 2.8][m]! * S * (1 + lift * 0.2);
          const tip = add(F, rot(fd, sp * (k % 2 ? -1 : 1)), tl);
          claws += `M${f1(F.x)} ${f1(F.y)}L${f1(tip.x)} ${f1(tip.y)}`;
        });
      });
      parts.claws.setAttribute("d", claws);
      parts.claws.setAttribute("stroke-width", (1.5 * S).toFixed(2));

      // Body outline around the spine.
      const L: V[] = [];
      const R: V[] = [];
      for (let i = 0; i < N; i++) {
        const { n } = frameAt(q, i);
        const w = widthAt(i) * (i < 4 ? 1 + bob * 0.09 : 1);
        L.push(o(add(q[i]!, n, w)));
        R.unshift(o(add(q[i]!, n, -w)));
      }
      const { f: f0, n: n0 } = frameAt(q, 0);
      const snout = o(add(q[0]!, f0, 3 * S));
      const tip = o(add(q[N - 1]!, frameAt(q, N - 1).f, -2 * S));
      const outline = smooth([snout, ...L, tip, ...R]);
      parts.body.setAttribute("d", outline);
      parts.body.setAttribute("stroke-width", (0.9 * S).toFixed(2));
      parts.hit.setAttribute("d", outline);
      parts.head.setAttribute("d", smooth([snout, ...L.slice(0, 5), o(q[5]!), ...R.slice(N - 5)]));

      // Spiky fringe down each side of the body, little spikes behind the head, and the beard under the jaw.
      let spikes = "";
      let beard = "";
      const spike = (i: number, fr: number, s: number, l: number, w: number) => {
        const base = lerp(q[i]!, q[i + 1]!, fr);
        const { f, n } = frameAt(q, i);
        const at = add(base, n, s * (widthAt(i) + (widthAt(i + 1) - widthAt(i)) * fr) * 0.96);
        const tp = add(add(at, n, s * l), f, -l * 0.45);
        const b1 = add(at, f, w);
        const b2 = add(at, f, -w);
        return `M${f1(o(b1).x)} ${f1(o(b1).y)}L${f1(o(tp).x)} ${f1(o(tp).y)}L${f1(o(b2).x)} ${f1(o(b2).y)}Z`;
      };
      for (const s of [1, -1]) {
        for (let j = 5; j < 13; j += 0.5) spikes += spike(Math.floor(j), j % 1, s, (2.6 + flat * 0.8) * S, 1.3 * S);
        spikes += spike(2, 0.6, s, 2.6 * S, 1.1 * S);
        for (let j = 3; j < 5; j += 0.34) beard += spike(Math.floor(j), j % 1, s, (3.6 + puff * 2.6) * S, 1.2 * S);
      }
      parts.spikes.setAttribute("d", spikes);
      parts.beard.setAttribute("d", beard);
      parts.beard.setAttribute("fill", mix(C.beard, C.beardDark, puff));

      let ridge = "";
      for (let i = 3; i < 20; i++) {
        const v = o(q[i]!);
        ridge += `${i === 3 ? "M" : "L"}${f1(v.x)} ${f1(v.y)}`;
      }
      parts.ridge.setAttribute("d", ridge);
      parts.ridge.setAttribute("stroke-width", (3.2 * S).toFixed(2));

      let pattern = "";
      for (const [at, u, rad] of BLOTCHES) {
        const i = Math.floor(at);
        const fr = at - i;
        const w = widthAt(i) + (widthAt(i + 1) - widthAt(i)) * fr;
        pattern += circle(o(add(lerp(q[i]!, q[i + 1]!, fr), frameAt(q, i).n, u * w)), rad * S);
      }
      parts.pattern.setAttribute("d", pattern);

      let bands = "";
      for (let i = 14; i < N - 1; i += 2) {
        const { n } = frameAt(q, i);
        const a = o(add(q[i]!, n, widthAt(i) * 0.9));
        const b = o(add(q[i]!, n, -widthAt(i) * 0.9));
        bands += `M${f1(a.x)} ${f1(a.y)}L${f1(b.x)} ${f1(b.y)}`;
      }
      parts.bands.setAttribute("d", bands);
      parts.bands.setAttribute("stroke-width", (2 * S).toFixed(2));

      // Eyes on the sides of the head; basking narrows them, a blink shuts them.
      const { f: fh, n: nh } = frameAt(q, 2);
      const blinking = t > blinkAt && t < blinkAt + 0.16;
      const open = blinking ? 0.12 : 1 - sleep * 0.78;
      let eyes = "";
      let glint = "";
      for (const s of [1, -1]) {
        const ec = o(add(add(q[2]!, nh, s * widthAt(2) * 0.7), fh, 1 * S));
        eyes += circle(ec, 2.1 * S * open);
        if (open > 0.5) glint += circle(add(ec, fh, 0.8 * S), 0.55 * S);
      }
      parts.eyes.setAttribute("d", eyes);
      parts.glint.setAttribute("d", glint);
      parts.nose.setAttribute("d", [1, -1].map((s) => circle(o(add(add(q[0]!, n0, s * 1.4 * S), f0, 1.6 * S)), 0.45 * S)).join(""));
    }

    function frame(now: number) {
      const dt = Math.min(0.04, (now - last) / 1000 || 0);
      last = now;
      t += dt;
      const step = steps[0];
      if (!step) return finish();
      let moving = false;
      let resting = false;

      if (step.kind === "look" || step.kind === "rest") {
        walking = false;
        speedNow = 0;
        idle += dt;
        if (stepLeft === 0) stepLeft = step.dur;
        stepLeft -= dt;
        resting = step.kind === "rest";
        const lying = resting && step.dur - stepLeft;
        if (t > nextGlance) {
          // Reptiles snap the head to a new angle, then hold it.
          yawTarget = resting ? r(-0.25, 0.25) : r(-0.5, 0.5);
          nextGlance = t + (resting ? r(2.5, 6) : r(0.5, 1.3));
          if (Math.random() < 0.3) blinkAt = t + r(0, 0.4);
        }
        if (resting && lying && lying > 2) {
          if (t > nextBob) {
            bobAt = t;
            nextBob = t + r(7, 13);
          }
          if (t > nextWave) {
            waveAt = t;
            waveLeg = Math.random() < 0.5 ? 0 : 1;
            nextWave = t + r(10, 18);
          }
        }
        if (stepLeft <= 0) {
          stepLeft = 0;
          yawTarget = 0;
          steps.shift();
        }
      } else {
        const toGo = sub(step.to, p[0]!);
        const dist = len(toGo);
        if (dist < 6 * S) {
          steps.shift();
        } else {
          burst -= dt;
          if (burst <= 0) {
            // A deliberate walk with the odd pause; when fleeing, no pauses.
            walking = step.flee ? true : !walking;
            burst = walking ? r(0.9, 2.2) : r(0.25, 0.8);
          }
          if (walking) {
            moving = true;
            idle = 0;
            yawTarget = 0;
            const d0 = wrap(ang(toGo) - heading);
            heading += Math.sign(d0) * Math.min(Math.abs(d0), (step.flee ? 7 : 3.2) * dt);
            speedNow = Math.min(step.speed, speedNow + step.speed * dt * 4) * (Math.abs(d0) > 1 ? 0.5 : 1);
            const d = Math.min(speedNow * dt, dist);
            // Lateral undulation: the head weaves and the spine chain turns it into an S-wave down the body.
            const wave = heading + Math.sin(phase) * 0.22;
            p[0] = add(p[0]!, { x: Math.cos(wave), y: Math.sin(wave) }, d);
            phase += (d / (34 * S)) * Math.PI * 2;
            follow();
          } else {
            speedNow = 0;
            idle += dt;
          }
        }
      }

      flat += ((resting ? 1 : 0) - flat) * Math.min(1, dt * (resting ? 0.8 : 3));
      const bobbing = t - bobAt < 2.2;
      sleep += ((resting && !bobbing && t - waveAt > 2.2 && idle > 3 ? 1 : 0) - sleep) * Math.min(1, dt * 0.7);
      puff += ((bobbing ? 1 : 0) - puff) * Math.min(1, dt * (bobbing ? 5 : 0.8));
      yaw += (yawTarget - yaw) * Math.min(1, dt * 18);
      stepFeet(dt, moving);
      render();
      raf = requestAnimationFrame(frame);
    }

    function finish() {
      node!.style.display = "none";
      steps = [];
      timer = window.setTimeout(visit, r(45000, 90000));
    }

    function visit() {
      if (document.hidden) {
        timer = window.setTimeout(visit, 10000);
        return;
      }
      steps = plan();
      walking = true;
      burst = r(1, 2);
      speedNow = 0;
      stepLeft = 0;
      idle = 0;
      flat = sleep = puff = 0;
      curl = Math.random() < 0.5 ? 1 : -1;
      yaw = yawTarget = 0;
      bobAt = waveAt = -9;
      nextBob = t + r(3, 6);
      nextWave = t + r(6, 10);
      node!.style.display = "block";
      last = performance.now();
      render();
      raf = requestAnimationFrame(frame);
    }

    flee.current = () => {
      if (!steps.length || (steps[0]?.kind === "move" && steps[0].flee)) return;
      const w = W();
      const toLeft = p[0]!.x < w / 2;
      const off = bodyLen() + 60;
      steps = [{ kind: "move", to: { x: toLeft ? -off : w + off, y: p[0]!.y + r(-120, 120) }, speed: 380 * S, flee: true }];
      walking = true;
      stepLeft = 0;
      yawTarget = 0;
      sleep = 0;
      waveAt = -9;
      bobAt = t; // a startled bob and a dark beard on the way out
    };

    const q = new URLSearchParams(window.location.search);
    const first = q.has("dragon") || q.has("gecko") ? 400 : r(7000, 12000);
    timer = window.setTimeout(visit, first);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="lp-dragon-layer" aria-hidden="true">
      <div ref={el} className="lp-dragon">
        <svg viewBox={`0 0 ${VIEW} ${VIEW}`} width={VIEW} height={VIEW}>
          {[0, 1, 2, 3].map((k) => (
            <path key={k} className={`limb${k}`} fill="none" stroke={C.limb} strokeLinecap="round" strokeLinejoin="round" />
          ))}
          <path className="claws" fill="none" stroke={C.edge} strokeLinecap="round" />
          <path className="spikes" fill={C.spike} stroke={C.edge} strokeWidth="0.8" strokeLinejoin="round" />
          <path className="beard" stroke={C.edge} strokeWidth="0.8" strokeLinejoin="round" />
          <path className="body" fill={C.body} stroke={C.edge} />
          <path className="headtint" fill={C.head} opacity="0.7" />
          <path className="ridge" fill="none" stroke={C.ridge} strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
          <path className="pattern" fill={C.pattern} opacity="0.55" />
          <path className="bands" fill="none" stroke={C.pattern} strokeLinecap="round" opacity="0.55" />
          <path className="eyes" fill={C.eye} stroke="#5C3A14" strokeWidth="1" />
          <path className="glint" fill="#fff" opacity="0.85" />
          <path className="nose" fill={C.edge} />
          <path
            className="hit"
            fill="transparent"
            stroke="transparent"
            strokeWidth="20"
            onPointerEnter={() => flee.current()}
            onPointerDown={() => flee.current()}
          />
        </svg>
      </div>
    </div>
  );
}
