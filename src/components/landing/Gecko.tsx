"use client";

import { useEffect, useRef } from "react";

// A leopard gecko that visits now and then. It is animated procedurally, the way game creatures are:
// - the head steers and the spine follows it as a chain of joints with limited bend, so the body and tail
//   swing and S-curve on their own;
// - each foot stays planted on the page until the body pulls too far ahead, then steps, in diagonal pairs,
//   with two-bone IK for the elbows and knees.
// It dashes in from the side, freezes, looks around, licks, blinks, sways its tail, then runs off. Hover or
// tap and it bolts. All drawing happens in one rAF loop writing SVG paths, so React never re-renders during
// a visit. Off with reduced motion. Add ?gecko to the URL to call it straight away.

type V = { x: number; y: number };
type Step = { kind: "move"; to: V; speed: number; flee?: boolean } | { kind: "look"; dur: number };
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
const f1 = (n: number) => n.toFixed(1);

// Spine: 22 joints, snout to tail tip. Half-widths give the leopard gecko shape: broad head, thin neck,
// plump body, and the fat tail it stores fat in.
const N = 22;
const SEG = 5.2;
const HW = [2.6, 5.6, 7.2, 6.9, 5.0, 5.6, 7.6, 8.8, 9.3, 9.3, 9.0, 8.2, 7.0, 6.6, 6.6, 6.1, 5.3, 4.3, 3.3, 2.4, 1.5, 0.7];
// Most a joint may bend relative to the one in front (radians): stiff body, loose tail.
const BEND = [0, 0, 0.12, 0.22, 0.28, 0.2, 0.12, 0.1, 0.1, 0.1, 0.12, 0.14, 0.2, 0.26, 0.3, 0.32, 0.34, 0.36, 0.38, 0.4, 0.4, 0.4];
const FRONT = 6;
const HIND = 12;
const UPPER = 8.5;
const LOWER = 8.5;
const VIEW = 300; // size of the moving SVG window around the gecko

// Spot pattern, fixed so it never shimmers: [joint + fraction, offset across the body -1..1, radius].
const SPOTS: [number, number, number][] = (() => {
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const out: [number, number, number][] = [];
  for (let k = 0; k < 64; k++) {
    const at = 1.6 + rnd() * 18.6;
    out.push([at, (rnd() * 2 - 1) * 0.72, 0.6 + rnd() * (at > 13 ? 0.9 : 1.2)]);
  }
  return out;
})();

const C = { body: "#EDBE45", limb: "#F0C95A", edge: "#8C6418", spot: "#3A2814", ridge: "#FFF0B0", eye: "#1C140B", tongue: "#E8577A" };

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

export function Gecko() {
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
      toes: $("toes"),
      pads: $("pads"),
      body: $("body"),
      ridge: $("ridge"),
      spots: $("spots"),
      eyes: $("eyes"),
      lids: $("lids"),
      glint: $("glint"),
      nose: $("nose"),
      tongue: $("tongue"),
      hit: $("hit"),
    };

    let S = 1;
    let timer = 0;
    let raf = 0;
    let steps: Step[] = [];
    let p: V[] = [];
    let feet: Foot[] = [];
    let heading = 0;
    let phase = 0;
    let dashing = true;
    let burst = 0;
    let lookLeft = 0;
    let yaw = 0;
    let yawTarget = 0;
    let nextGlance = 0;
    let flick = 0;
    let blinkAt = -9;
    let lickAt = -9;
    let speedNow = 0;
    let idle = 0;
    let last = 0;
    let t = 0;

    const W = () => layer.clientWidth;

    // Legs: 0 front-left, 1 front-right, 2 hind-left, 3 hind-right. Diagonal pairs step together: {0,3} and {1,2}.
    const legIdx = (k: number) => (k < 2 ? FRONT : HIND);
    const legSide = (k: number) => (k % 2 === 0 ? 1 : -1);
    function anchor(k: number, q = p) {
      const i = legIdx(k);
      return add(q[i]!, frameAt(q, i).n, legSide(k) * HW[i]! * 0.65 * S);
    }
    function rest(k: number) {
      const { f, n } = frameAt(p, legIdx(k));
      return add(add(anchor(k), f, (k < 2 ? 6 : -4) * S), n, legSide(k) * 13 * S);
    }

    function plan(): Step[] {
      const w = W();
      S = w < 640 ? 0.8 : 1;
      const top = -layer!.getBoundingClientRect().top;
      const left = Math.random() < 0.5;
      const sx = left ? -1 : 1;
      const edge = left ? 0 : w;
      const y0 = top + window.innerHeight * r(0.3, 0.72);
      heading = left ? 0 : Math.PI;
      const head = { x: edge + sx * 20, y: y0 };
      p = Array.from({ length: N }, (_, i) => ({ x: head.x + sx * i * SEG * S, y: head.y }));
      feet = [0, 1, 2, 3].map((k) => {
        const at = rest(k);
        return { pos: at, from: at, to: at, t: -1 };
      });
      const reach = w < 640 ? r(70, 150) : r(110, Math.min(300, w * 0.24));
      const p1 = { x: edge - sx * reach, y: y0 + r(-70, 70) };
      const out: Step[] = [{ kind: "move", to: p1, speed: r(230, 300) }, { kind: "look", dur: r(2.4, 4) }];
      let end = p1;
      if (Math.random() < 0.6) {
        end = { x: p1.x - sx * r(-40, 90), y: p1.y + r(-110, 110) };
        out.push({ kind: "move", to: end, speed: r(200, 280) }, { kind: "look", dur: r(1.6, 3) });
      }
      // Usually back out the way it came; sometimes a dash right across.
      const across = Math.random() < 0.2;
      const exitX = across ? w - edge - sx * 220 : edge + sx * 220;
      out.push({ kind: "move", to: { x: exitX, y: end.y + r(-140, 140) }, speed: across ? 360 : 300 });
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
        if (ft.t >= 0) {
          ft.t += dt / Math.max(0.055, Math.min(0.12, 9 / Math.max(1, speedNow)));
          if (ft.t >= 1) {
            ft.t = -1;
            ft.pos = ft.to;
          } else ft.pos = lerp(ft.from, ft.to, ft.t);
          return;
        }
        const target = rest(k);
        const off = len(sub(ft.pos, target));
        // While running, step when the foot falls behind; once still for a moment, tidy feet under the body.
        const limit = (moving ? 11 : idle > 0.25 ? 2.5 : 99) * S;
        // A foot left far behind (sharp turn, spawn) steps at once, whatever the gait says.
        if (off > limit && (!otherPairStepping(k) || off > limit * 2.2)) {
          ft.from = ft.pos;
          ft.to = moving ? add(target, dir, 7 * S) : target;
          ft.t = 0;
        }
      });
    }

    function render() {
      // Rendering-only offsets: the head glance, and the tail's sway or flick.
      const q = p.map((v) => ({ ...v }));
      for (let i = 0; i < 3; i++) q[i] = add(p[3]!, rot(sub(p[i]!, p[3]!), yaw));
      let acc = 0;
      for (let i = 13; i < N; i++) {
        const j = i - 13;
        acc += Math.sin(t * 1.7 - j * 0.55) * 0.035 * (dashing ? 0 : 1) + flick * Math.sin(t * 26 - j * 0.8) * 0.16;
        q[i] = add(q[i - 1]!, rot(sub(p[i]!, p[i - 1]!), acc));
      }

      const c = q[9]!;
      const o = (v: V) => ({ x: v.x - c.x + VIEW / 2, y: v.y - c.y + VIEW / 2 });
      node!.style.transform = `translate(${f1(c.x - VIEW / 2)}px, ${f1(c.y - VIEW / 2)}px)`;

      // Legs, drawn under the body.
      let toes = "";
      let pads = "";
      feet.forEach((ft, k) => {
        const a = anchor(k, q);
        const lift = ft.t >= 0 ? Math.sin(ft.t * Math.PI) : 0;
        const u = UPPER * S;
        const l = LOWER * S;
        // Never draw a leg longer than it is: if the foot is out of reach, the leg reaches toward it.
        const raw = sub(ft.pos, a);
        const foot = len(raw) > u + l - 0.1 ? add(a, unit(raw), u + l - 0.1) : ft.pos;
        const d = Math.min(Math.max(len(sub(foot, a)), 2), u + l - 0.1);
        const th = ang(sub(foot, a));
        const al = Math.acos(Math.min(1, Math.max(-1, (u * u + d * d - l * l) / (2 * u * d))));
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
        parts.limbs[k]!.setAttribute("stroke-width", ((4.2 + lift * 0.8) * S).toFixed(2));
        const fd = unit(sub(foot, elbow));
        [-1.1, -0.55, 0, 0.55, 1.05].forEach((sp, n) => {
          const tl = [2.4, 3.4, 3.9, 3.5, 2.6][n]! * S * (1 + lift * 0.15);
          const tip = add(F, rot(fd, sp * (k % 2 ? -1 : 1)), tl);
          toes += `M${f1(F.x)} ${f1(F.y)}L${f1(tip.x)} ${f1(tip.y)}`;
          pads += circle(tip, 1.05 * S);
        });
      });
      parts.toes.setAttribute("d", toes);
      parts.toes.setAttribute("stroke-width", (1.5 * S).toFixed(2));
      parts.pads.setAttribute("d", pads);

      // Body outline around the spine.
      const L: V[] = [];
      const R: V[] = [];
      for (let i = 0; i < N; i++) {
        const { n } = frameAt(q, i);
        L.push(o(add(q[i]!, n, HW[i]! * S)));
        R.unshift(o(add(q[i]!, n, -HW[i]! * S)));
      }
      const { f: f0, n: n0 } = frameAt(q, 0);
      const snout = o(add(q[0]!, f0, 3.2 * S));
      const tip = o(add(q[N - 1]!, frameAt(q, N - 1).f, -1.5 * S));
      const outline = smooth([snout, ...L, tip, ...R]);
      parts.body.setAttribute("d", outline);
      parts.body.setAttribute("stroke-width", (0.9 * S).toFixed(2));
      parts.hit.setAttribute("d", outline);

      let ridge = "";
      for (let i = 2; i < 19; i++) {
        const v = o(q[i]!);
        ridge += `${i === 2 ? "M" : "L"}${f1(v.x)} ${f1(v.y)}`;
      }
      parts.ridge.setAttribute("d", ridge);
      parts.ridge.setAttribute("stroke-width", (4 * S).toFixed(2));

      let spots = "";
      for (const [at, u, rad] of SPOTS) {
        const i = Math.floor(at);
        const fr = at - i;
        const w = HW[i]! + (HW[i + 1]! - HW[i]!) * fr;
        spots += circle(o(add(lerp(q[i]!, q[i + 1]!, fr), frameAt(q, i).n, u * w * S)), rad * S);
      }
      parts.spots.setAttribute("d", spots);

      // Eyes bulge from the sides of the head; lids close over them to blink.
      const { f: fh, n: nh } = frameAt(q, 2);
      const blinking = t > blinkAt && t < blinkAt + 0.14;
      let eyes = "";
      let lids = "";
      let glint = "";
      for (const s of [1, -1]) {
        const ec = o(add(add(q[2]!, nh, s * HW[2]! * 0.74 * S), fh, 0.8 * S));
        eyes += circle(ec, 2.5 * S);
        if (blinking) lids += circle(ec, 2.7 * S);
        glint += circle(add(ec, fh, 0.9 * S), 0.6 * S);
      }
      parts.eyes.setAttribute("d", eyes);
      parts.lids.setAttribute("d", lids);
      parts.glint.setAttribute("d", blinking ? "" : glint);
      parts.nose.setAttribute("d", [1, -1].map((s) => circle(o(add(add(q[0]!, n0, s * 1.5 * S), f0, 1.6 * S)), 0.45 * S)).join(""));

      // A quick lick: a short pink tongue, out and back.
      const lt = (t - lickAt) / 0.22;
      if (lt > 0 && lt < 1) {
        const a = add(snout, f0, Math.sin(lt * Math.PI) * 5 * S);
        const b1 = add(a, rot(f0, 0.5), 1.6 * S);
        const b2 = add(a, rot(f0, -0.5), 1.6 * S);
        parts.tongue.setAttribute("d", `M${f1(snout.x)} ${f1(snout.y)}L${f1(a.x)} ${f1(a.y)}L${f1(b1.x)} ${f1(b1.y)}M${f1(a.x)} ${f1(a.y)}L${f1(b2.x)} ${f1(b2.y)}`);
        parts.tongue.setAttribute("stroke-width", (1.3 * S).toFixed(2));
      } else parts.tongue.setAttribute("d", "");
    }

    function frame(now: number) {
      const dt = Math.min(0.04, (now - last) / 1000 || 0);
      last = now;
      t += dt;
      flick = Math.max(0, flick - dt * 1.4);
      const step = steps[0];
      if (!step) return finish();
      let moving = false;

      if (step.kind === "look") {
        dashing = false;
        speedNow = 0;
        idle += dt;
        if (lookLeft === 0) lookLeft = step.dur;
        lookLeft -= dt;
        if (t > nextGlance) {
          // Reptiles snap the head to a new angle, then hold it.
          yawTarget = r(-0.55, 0.55);
          nextGlance = t + r(0.4, 1.2);
          if (Math.random() < 0.25) flick = 0.6;
          if (Math.random() < 0.35) blinkAt = t + r(0, 0.3);
          if (Math.random() < 0.3) lickAt = t + r(0.05, 0.3);
        }
        if (lookLeft <= 0) {
          lookLeft = 0;
          yawTarget = 0;
          steps.shift();
        }
      } else {
        const toGo = sub(step.to, p[0]!);
        const dist = len(toGo);
        if (dist < 8) {
          steps.shift();
        } else {
          burst -= dt;
          if (burst <= 0) {
            // Geckos move in dashes with tiny freezes in between.
            dashing = step.flee ? true : !dashing;
            burst = dashing ? r(0.35, 0.9) : r(0.12, 0.5);
          }
          if (dashing) {
            moving = true;
            idle = 0;
            yawTarget = 0;
            const d0 = wrap(ang(toGo) - heading);
            heading += Math.sign(d0) * Math.min(Math.abs(d0), (step.flee ? 9 : 5) * dt);
            speedNow = Math.min(step.speed, speedNow + step.speed * dt * 6) * (Math.abs(d0) > 1 ? 0.5 : 1);
            const d = Math.min(speedNow * dt, dist);
            // Lateral undulation: the head weaves and the spine chain turns it into an S-wave down the body.
            const wave = heading + Math.sin(phase) * 0.32;
            p[0] = add(p[0]!, { x: Math.cos(wave), y: Math.sin(wave) }, d);
            phase += (d / (30 * S)) * Math.PI * 2;
            follow();
          } else {
            speedNow = 0;
            idle += dt;
          }
        }
      }
      yaw += (yawTarget - yaw) * Math.min(1, dt * 20);
      stepFeet(dt, moving);
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
      burst = r(0.5, 0.9);
      speedNow = 0;
      lookLeft = 0;
      idle = 0;
      yaw = yawTarget = 0;
      node!.style.display = "block";
      last = performance.now();
      render();
      raf = requestAnimationFrame(frame);
    }

    flee.current = () => {
      if (!steps.length || (steps[0]?.kind === "move" && steps[0].flee)) return;
      const w = W();
      const toLeft = p[0]!.x < w / 2;
      steps = [{ kind: "move", to: { x: toLeft ? -240 : w + 240, y: p[0]!.y + r(-120, 120) }, speed: 720, flee: true }];
      dashing = true;
      flick = 0.9;
      lookLeft = 0;
      yawTarget = 0;
    };

    const first = new URLSearchParams(window.location.search).has("gecko") ? 400 : r(8000, 14000);
    timer = window.setTimeout(visit, first);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="lp-gecko-layer" aria-hidden="true">
      <div ref={el} className="lp-gecko">
        <svg viewBox={`0 0 ${VIEW} ${VIEW}`} width={VIEW} height={VIEW}>
          {[0, 1, 2, 3].map((k) => (
            <path key={k} className={`limb${k}`} fill="none" stroke={C.limb} strokeLinecap="round" strokeLinejoin="round" />
          ))}
          <path className="toes" fill="none" stroke={C.limb} strokeLinecap="round" />
          <path className="pads" fill={C.limb} />
          <path className="body" fill={C.body} stroke={C.edge} />
          <path className="ridge" fill="none" stroke={C.ridge} strokeLinecap="round" strokeLinejoin="round" opacity="0.35" />
          <path className="spots" fill={C.spot} opacity="0.82" />
          <path className="eyes" fill={C.eye} stroke="#6B4A14" strokeWidth="0.6" />
          <path className="lids" fill={C.body} />
          <path className="glint" fill="#fff" opacity="0.85" />
          <path className="nose" fill={C.spot} />
          <path className="tongue" fill="none" stroke={C.tongue} strokeLinecap="round" strokeLinejoin="round" />
          <path
            className="hit"
            fill="transparent"
            stroke="transparent"
            strokeWidth="16"
            onPointerEnter={() => flee.current()}
            onPointerDown={() => flee.current()}
          />
        </svg>
      </div>
    </div>
  );
}
