// Themed backdrops for hero slides, drawn as layered SVG (a few KB, no images). The scene sits on the left
// of the card and fades into the slide's gradient on the right. Layers shift by depth with the hover tilt
// (--tx/--ty on .lp-tilt), and the fronds and vines sway slowly. Output is deterministic (seeded), so the
// server and client render the same markup.

export type SceneKey = "rainforest" | "premiere" | "ocean";

const W = 1200;
const H = 600;

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f = (n: number) => n.toFixed(1);

/** A leaf pointing along `deg` (0 = up) with its base at x,y. */
function leaf(x: number, y: number, len: number, deg: number, w: number, fill: string) {
  return `<path d="M0 0Q${f(w)} ${f(-len * 0.45)} 0 ${f(-len)}Q${f(-w)} ${f(-len * 0.45)} 0 0Z" transform="translate(${f(x)} ${f(y)}) rotate(${f(deg)})" fill="${fill}"/>`;
}

type Pt = [number, number];
/** A palm-like frond: a stem on a quadratic curve with leaflets on both sides, shrinking toward the tip. */
function frond(p0: Pt, c: Pt, p1: Pt, n: number, leafLen: number, fill: string, stem: string) {
  let s = `<path d="M${p0[0]} ${p0[1]}Q${c[0]} ${c[1]} ${p1[0]} ${p1[1]}" stroke="${stem}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  for (let k = 1; k <= n; k++) {
    const t = k / (n + 1);
    const u = 1 - t;
    const x = u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0];
    const y = u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1];
    const tx = 2 * u * (c[0] - p0[0]) + 2 * t * (p1[0] - c[0]);
    const ty = 2 * u * (c[1] - p0[1]) + 2 * t * (p1[1] - c[1]);
    const base = (Math.atan2(tx, -ty) * 180) / Math.PI;
    const len = leafLen * (1 - t * 0.55);
    s += leaf(x, y, len, base - 58, len * 0.22, fill) + leaf(x, y, len, base + 58, len * 0.22, fill);
  }
  return s;
}

function rainforest() {
  const r = rng(11);
  const defs =
    `<linearGradient id="lp-shaft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF6C8" stop-opacity=".5"/><stop offset="1" stop-color="#FFF6C8" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="lp-mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E9F3D9" stop-opacity="0"/><stop offset="1" stop-color="#E9F3D9" stop-opacity=".3"/></linearGradient>`;

  // Far: misty trunks with leafy crowns, light shafts, ground mist.
  let far = "";
  for (let k = 0; k < 9; k++) {
    const x = 20 + k * 78 + r() * 30;
    const w = 9 + r() * 10;
    const top = 90 + r() * 120;
    far += `<rect x="${f(x)}" y="${f(top)}" width="${f(w)}" height="${H}" fill="#24492F" opacity=".45"/>`;
    // Canopy: a spray of leaves around the top of the trunk.
    let crown = "";
    for (let j = 0; j < 12; j++) crown += leaf(x + w / 2 + (r() - 0.5) * 30, top + 10 + r() * 30, 50 + r() * 40, -110 + r() * 220, 16, "#2F5E3A");
    far += `<g opacity=".45">${crown}</g>`;
  }
  for (let k = 0; k < 4; k++) {
    const x = 90 + k * 130 + r() * 40;
    far += `<polygon points="${f(x)},0 ${f(x + 34)},0 ${f(x + 150)},${H} ${f(x + 40)},${H}" fill="url(#lp-shaft)" opacity=".7"/>`;
  }
  far += `<rect y="360" width="${W}" height="240" fill="url(#lp-mist)"/>`;

  // Middle: hanging vines with small leaves, a few big leaves at the bottom.
  let mid = "";
  for (let k = 0; k < 7; k++) {
    const x = 40 + k * 95 + r() * 40;
    const len = 180 + r() * 220;
    let v = `<path d="M${f(x)} -10C${f(x + 30)} ${f(len * 0.3)} ${f(x - 30)} ${f(len * 0.6)} ${f(x + 6)} ${f(len)}" stroke="#163A22" stroke-width="3" fill="none"/>`;
    for (let y = 30; y < len; y += 34) v += leaf(x + Math.sin(y / 40) * 14, y, 22, (y / 34) % 2 ? 120 : -120, 7, "#2A6B3C");
    mid += `<g class="lp-vine" style="animation-delay:${f(-r() * 6)}s">${v}</g>`;
  }
  for (let k = 0; k < 6; k++) {
    mid += leaf(60 + r() * 520, 510 + r() * 120, 140 + r() * 80, -60 + r() * 120, 52, k % 2 ? "#2E7D46" : "#24683A");
  }

  // Near: big dark fronds from the corners.
  const near =
    `<g class="lp-sway">${frond([-60, 640], [60, 370], [330, 290], 11, 120, "#0F3A20", "#0B2C18")}${frond([-40, 510], [140, 510], [360, 600], 8, 90, "#164A29", "#0F3A20")}</g>` +
    `<g class="lp-sway top">${frond([-50, -30], [90, 120], [300, 70], 10, 110, "#0F3A20", "#0B2C18")}</g>`;

  return `<defs>${defs}</defs><g class="d1">${far}</g><g class="d2">${mid}</g><g class="d3">${near}</g>`;
}

function premiere() {
  const defs =
    `<linearGradient id="lp-fold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3E0410"/><stop offset=".5" stop-color="#B3122E"/><stop offset="1" stop-color="#3E0410"/></linearGradient>` +
    `<linearGradient id="lp-beam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FFF4D6" stop-opacity=".5"/><stop offset="1" stop-color="#FFF4D6" stop-opacity="0"/></linearGradient>` +
    `<clipPath id="lp-tie"><path d="M-10 0L560 0C470 170 400 300 300 380C380 450 420 530 440 ${H}L-10 ${H}Z"/></clipPath>` +
    `<radialGradient id="lp-bulb"><stop offset="0" stop-color="#FFF6D6"/><stop offset=".35" stop-color="#FFE7A0" stop-opacity=".9"/><stop offset="1" stop-color="#FFE7A0" stop-opacity="0"/></radialGradient>`;

  // Far: two spotlight beams that sweep slowly.
  const far = `<g class="lp-beam" opacity=".55"><polygon points="560,${H} 600,${H} 260,0 60,0" fill="url(#lp-beam)"/><polygon points="560,${H} 590,${H} 740,0 560,0" fill="url(#lp-beam)" opacity=".6"/></g>`;

  // Middle: a tied-back velvet curtain (no tie: it would sit behind the headline).
  let folds = "";
  for (let k = 0; k < 14; k++) folds += `<rect x="${-10 + k * 42}" y="0" width="46" height="${H}" fill="url(#lp-fold)"/>`;
  const mid =
    `<g clip-path="url(#lp-tie)"><g class="lp-sway top" style="animation-duration:11s">${folds}</g></g>`;

  // Near: a scalloped valance and a marquee bulb border along the top.
  const sc = (i: number) => `Q${W - i * 76 - 38} 88 ${W - (i + 1) * 76} 40`;
  let near = `<path d="M-10 0H${W}V40${Array.from({ length: 16 }, (_, i) => sc(i)).join("")}Z" fill="#7A0A1F"/>`;
  near += `<path d="M-10 40${Array.from({ length: 16 }, (_, i) => `Q${i * 76 + 38} 88 ${(i + 1) * 76} 40`).join("")}" stroke="#E8B84A" stroke-width="4" fill="none" opacity=".9"/>`;
  for (let x = 22, k = 0; x < W; x += 38, k++) {
    near += `<circle cx="${x}" cy="18" r="11" fill="url(#lp-bulb)" class="lp-twinkle"${k % 2 ? ' style="animation-delay:-1.2s"' : ""}/>`;
  }
  return `<defs>${defs}</defs><g class="d1">${far}</g><g class="d2">${mid}</g><g class="d3">${near}</g>`;
}

function ocean() {
  const r = rng(205);
  const defs = `<radialGradient id="lp-sun"><stop offset="0" stop-color="#FFF8DC" stop-opacity=".85"/><stop offset="1" stop-color="#FFF8DC" stop-opacity="0"/></radialGradient>`;

  // Far: a low sun with glow, and a few gulls.
  let far = `<circle cx="330" cy="320" r="200" fill="url(#lp-sun)" class="lp-pulse"/><circle cx="330" cy="320" r="78" fill="#FFF6D5"/>`;
  for (let k = 0; k < 3; k++) {
    const x = 120 + k * 120 + r() * 40;
    const y = 120 + r() * 60;
    const s = 1 + r() * 0.5;
    far += `<path d="M${f(x)} ${f(y)}q${f(9 * s)} ${f(-9 * s)} ${f(18 * s)} 0q${f(9 * s)} ${f(-9 * s)} ${f(18 * s)} 0" stroke="#0B3550" stroke-width="2.4" fill="none" class="lp-bob" style="animation-delay:${f(-r() * 4)}s"/>`;
  }

  // Waves: five bands that roll sideways (each path is one period wider than the card so the loop is seamless).
  const cols = ["#7FD8F0", "#3FB4DA", "#1F8CB8", "#136A93", "#0B4A6E"];
  let mid = "";
  let near = "";
  cols.forEach((c, i) => {
    const y0 = 330 + i * 52;
    const amp = 6 + i * 3;
    const per = 200;
    let d = `M0 ${H}L0 ${y0}`;
    for (let x = 0; x <= W + per; x += 10) d += `L${x} ${f(y0 + amp * Math.sin((x / per) * Math.PI * 2 + i))}`;
    d += `L${W + per} ${H}Z`;
    const p = `<path d="${d}" fill="${c}" opacity="${i < 2 ? 0.8 : 0.95}" class="lp-drift${i % 2 ? " slow" : ""}"/>`;
    if (i < 3) mid += p;
    else near += p;
  });
  for (let k = 0; k < 16; k++) {
    mid += `<rect x="${f(250 + r() * 170)}" y="${f(338 + r() * 50)}" width="${f(10 + r() * 22)}" height="2" fill="#FFFBEA" class="lp-twinkle" style="animation-delay:${f(-r() * 2.4)}s"/>`;
  }
  return `<defs>${defs}</defs><g class="d1">${far}</g><g class="d2">${mid}</g><g class="d3">${near}</g>`;
}

const SCENES: Record<SceneKey, string> = { rainforest: rainforest(), premiere: premiere(), ocean: ocean() };

export function HeroScene({ scene }: { scene: SceneKey }) {
  return (
    <svg
      className="lp-scene"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMinYMid slice"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: SCENES[scene] }}
    />
  );
}
