// Real-time 3D renderer for the landing-page bearded dragon. Dragon.tsx runs the simulation (spine chain,
// planted feet, behaviour) and hands this module a pose every frame; this module turns it into a lit 3D
// lizard: a skinned body built around the spine with a procedurally painted, bump-mapped scale texture,
// cone spikes and beard, jointed legs with toes and claws, glossy eyes, and a soft contact shadow.
// It is loaded with a dynamic import the first time the dragon appears, so three.js never weighs on page load.

import * as THREE from "three";

export type V2 = { x: number; y: number };
export type LegPose = { joint: number; side: number; a: V2; e: V2; f: V2; toes: V2[]; lift: number };
export type Pose = {
  S: number;
  spine: V2[]; // joint positions in px, relative to the centre of the view, screen axes (y down)
  widths: number[]; // half width per joint, px
  legs: LegPose[];
  eyeOpen: number;
  puff: number;
  flat: number;
};

// Body height as a fraction of half width, per joint: wedge head, flat body, round tail.
const HR = [0.5, 0.56, 0.6, 0.6, 0.56, 0.62, 0.48, 0.44, 0.42, 0.42, 0.43, 0.46, 0.52, 0.66, 0.72, 0.76, 0.8, 0.82, 0.84, 0.86, 0.88, 0.9, 0.9, 0.9, 0.9, 0.9];
const RINGS = 84;
const AROUND = 22;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Catmull-Rom sample of a numeric series at fractional index. */
function cr(vals: number[], t: number) {
  const i = Math.floor(t);
  const f = t - i;
  const g = (k: number) => vals[Math.max(0, Math.min(vals.length - 1, k))]!;
  const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
  return 0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
}

/** Paints the skin: colour map and a matching bump map of overlapping scales, tubercles and markings. */
function paintSkin() {
  const W = 1024, H = 256;
  const col = document.createElement("canvas");
  const bump = document.createElement("canvas");
  col.width = bump.width = W;
  col.height = bump.height = H;
  const c = col.getContext("2d")!;
  const b = bump.getContext("2d")!;
  let seed = 3;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;

  // v runs around the body: 0 and 0.5 are the flanks, 0.25 the spine, 0.75 the belly.
  const g = c.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, "#b8834c");
  g.addColorStop(0.1, "#d29a5a");
  g.addColorStop(0.2, "#c8925a");
  g.addColorStop(0.5, "#c08a55");
  g.addColorStop(1, "#a67645");
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  // Pale belly and lower flanks.
  const belly = c.createLinearGradient(0, 0, 0, H);
  belly.addColorStop(0, "rgba(232,205,160,0.0)");
  belly.addColorStop(0.42, "rgba(232,205,160,0.0)");
  belly.addColorStop(0.62, "rgba(232,205,160,0.75)");
  belly.addColorStop(0.88, "rgba(232,205,160,0.75)");
  belly.addColorStop(1, "rgba(232,205,160,0.0)");
  c.fillStyle = belly;
  c.fillRect(0, 0, W, H);
  b.fillStyle = "#808080";
  b.fillRect(0, 0, W, H);

  // Back pattern: paired pale blotches either side of the spine, dark bars between, darker flank streaks.
  const spineV = 0.25 * H;
  for (let u = 0.2; u < 0.5; u += 0.034) {
    const x = u * W;
    for (const s of [-1, 1]) {
      c.fillStyle = "rgba(240,214,166,0.55)";
      c.beginPath();
      c.ellipse(x, spineV + s * 13, 16, 7, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "rgba(92,60,30,0.38)";
      c.beginPath();
      c.ellipse(x + 17, spineV + s * 29, 18, 6, s * 0.15, 0, Math.PI * 2);
      c.fill();
    }
  }
  // Head: darker mask through the eyes, paler crown.
  c.fillStyle = "rgba(90,58,28,0.35)";
  c.fillRect(0.04 * W, spineV - 40, 0.08 * W, 10);
  c.fillRect(0.04 * W, spineV + 30, 0.08 * W, 10);
  // Tail bands.
  for (let u = 0.5; u < 1; u += 0.045) {
    c.fillStyle = "rgba(84,54,26,0.42)";
    c.fillRect(u * W, 0, 0.018 * W, H * 0.6);
  }

  // Scales: small overlapping rounded scales everywhere, larger tubercles in rows over the back.
  const scale = (x: number, y: number, rx: number, ry: number, light: number, height: number) => {
    c.fillStyle = `rgba(${light > 0 ? "255,236,200" : "40,24,10"},${Math.abs(light)})`;
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
    const rg = b.createRadialGradient(x - rx * 0.2, y - ry * 0.25, 0, x, y, Math.max(rx, ry));
    rg.addColorStop(0, `rgba(255,255,255,${height})`);
    rg.addColorStop(0.7, `rgba(160,160,160,${height * 0.6})`);
    rg.addColorStop(1, "rgba(40,40,40,0.9)");
    b.fillStyle = rg;
    b.beginPath();
    b.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    b.fill();
  };
  // The texture is stretched around the body about 2.2x more than along it, so scales are drawn wide.
  for (let y = 2; y < H; y += 4.5) {
    for (let x = Math.round(y / 4.5) % 2 ? 0 : 7; x < W; x += 14) scale(x + (rnd() - 0.5) * 2, y, 7.2, 2.4, (rnd() - 0.5) * 0.2, 0.75);
  }
  for (let k = 0; k < 520; k++) {
    const u = 0.04 + rnd() * 0.6;
    const ring = rnd() < 0.5 ? 0.25 + (rnd() - 0.5) * 0.3 : rnd() < 0.5 ? 0.06 + rnd() * 0.06 : 0.44 + rnd() * 0.06;
    const r = 2.2 + rnd() * 2.2;
    scale(u * W, ring * H, r * 2.2, r * 0.9, 0.1 + rnd() * 0.16, 1);
  }

  const map = new THREE.CanvasTexture(col);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const bumpMap = new THREE.CanvasTexture(bump);
  return { map, bumpMap };
}

export function createDragonRenderer(container: HTMLElement, view: number) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(view, view, false);
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.className = "lp-dragon-gl";
  container.prepend(canvas);

  const scene = new THREE.Scene();
  const h = view / 2;
  const camera = new THREE.OrthographicCamera(-h, h, h, -h, 1, 2000);
  camera.position.set(0, 0, 800);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xfff1dc, 0x3a2614, 0.85));
  const sun = new THREE.DirectionalLight(0xfff0d8, 3.1);
  sun.position.set(-260, 260, 380);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -h;
  sun.shadow.camera.right = h;
  sun.shadow.camera.top = h;
  sun.shadow.camera.bottom = -h;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 1400;
  sun.shadow.radius = 6;
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xffd2a0, 0.6);
  rim.position.set(200, -150, 120);
  scene.add(rim);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(view, view), new THREE.ShadowMaterial({ opacity: 0.42 }));
  ground.receiveShadow = true;
  scene.add(ground);

  const { map, bumpMap } = paintSkin();
  const skin = new THREE.MeshStandardMaterial({ map, bumpMap, bumpScale: 2.2, roughness: 0.72, metalness: 0 });
  const limbBump = bumpMap.clone();
  limbBump.wrapS = limbBump.wrapT = THREE.RepeatWrapping;
  limbBump.repeat.set(3, 1.5);
  const limbSkin = new THREE.MeshStandardMaterial({ color: 0xb98754, bumpMap: limbBump, bumpScale: 2.4, roughness: 0.78 });
  const spikeMat = new THREE.MeshStandardMaterial({ color: 0xb78550, roughness: 0.65 });
  const beardMat = new THREE.MeshStandardMaterial({ color: 0x9c6b3a, roughness: 0.7 });
  const clawMat = new THREE.MeshStandardMaterial({ color: 0x2a1c10, roughness: 0.35 });
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x140d07, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
  const lidMat = new THREE.MeshStandardMaterial({ color: 0xa8743f, roughness: 0.8 });

  // Body: a tube of rings around the spine, rebuilt every frame.
  const vertsPerRing = AROUND + 1;
  const pos = new Float32Array((RINGS * vertsPerRing + 2) * 3);
  const uv = new Float32Array((RINGS * vertsPerRing + 2) * 2);
  const index: number[] = [];
  for (let r = 0; r < RINGS; r++) {
    for (let k = 0; k <= AROUND; k++) {
      const i = r * vertsPerRing + k;
      uv[i * 2] = r / (RINGS - 1);
      uv[i * 2 + 1] = k / AROUND;
      if (r < RINGS - 1 && k < AROUND) {
        const a = i, b2 = i + vertsPerRing, c = i + 1, d = i + vertsPerRing + 1;
        index.push(a, b2, c, c, b2, d);
      }
    }
  }
  const capFront = RINGS * vertsPerRing;
  const capBack = capFront + 1;
  for (let k = 0; k < AROUND; k++) {
    index.push(capFront, k + 1, k);
    const base = (RINGS - 1) * vertsPerRing;
    index.push(capBack, base + k, base + k + 1);
  }
  uv.set([0, 0.25, 1, 0.25], capFront * 2);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setIndex(index);
  const body = new THREE.Mesh(geo, skin);
  body.castShadow = true;
  body.frustumCulled = false;
  scene.add(body);

  // Instanced parts.
  const cyl = new THREE.CylinderGeometry(0.85, 1, 1, 10, 1);
  const cone = new THREE.ConeGeometry(1, 1, 6);
  const ball = new THREE.SphereGeometry(1, 16, 12);
  const mk = (g: THREE.BufferGeometry, m: THREE.Material, n: number) => {
    const im = new THREE.InstancedMesh(g, m, n);
    im.castShadow = true;
    im.frustumCulled = false;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(im);
    return im;
  };
  const upperGeo = new THREE.CylinderGeometry(0.66, 1, 1, 12, 1, true);
  const lowerGeo = new THREE.CylinderGeometry(0.8, 1, 1, 12, 1, true);
  const uppers = mk(upperGeo, limbSkin, 4);
  const lowers = mk(lowerGeo, limbSkin, 4);
  const limbs = mk(cyl, limbSkin, 20);
  const joints = mk(ball, limbSkin, 12);
  const claws = mk(cone, clawMat, 20);
  const spikes = mk(cone, spikeMat, 180);
  const beard = mk(cone, beardMat, 40);
  const lids = mk(ball, lidMat, 2);
  const eyes = mk(ball, eyeMat, 2);
  const nostrils = mk(ball, clawMat, 2);

  const m4 = new THREE.Matrix4();
  const qn = new THREE.Quaternion();
  const UP = new THREE.Vector3(0, 1, 0);
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const tmpD = new THREE.Vector3();
  const scl = new THREE.Vector3();

  /** Places a unit cylinder or cone (pointing +y) from a to b with the given radius. */
  function segment(im: THREE.InstancedMesh, n: number, a: THREE.Vector3, b2: THREE.Vector3, r: number) {
    tmpD.subVectors(b2, a);
    const l = tmpD.length() || 0.001;
    qn.setFromUnitVectors(UP, tmpD.normalize());
    tmpA.addVectors(a, b2).multiplyScalar(0.5);
    scl.set(r, l, r);
    m4.compose(tmpA, qn, scl);
    im.setMatrixAt(n, m4);
  }
  function spikeAt(im: THREE.InstancedMesh, n: number, base: THREE.Vector3, dir: THREE.Vector3, l: number, r: number) {
    qn.setFromUnitVectors(UP, tmpD.copy(dir).normalize());
    tmpA.copy(base).addScaledVector(tmpD, l * 0.5);
    scl.set(r, l, r);
    m4.compose(tmpA, qn, scl);
    im.setMatrixAt(n, m4);
  }
  function ballAt(im: THREE.InstancedMesh, n: number, p: THREE.Vector3, r: number, rz = r) {
    qn.identity();
    scl.set(r, r, rz);
    m4.compose(p, qn, scl);
    im.setMatrixAt(n, m4);
  }

  // Per-frame scratch for the resampled spine.
  const cx = new Float32Array(RINGS), cy = new Float32Array(RINGS), cw = new Float32Array(RINGS), ch = new Float32Array(RINGS), cz = new Float32Array(RINGS);
  const nx = new Float32Array(RINGS), ny = new Float32Array(RINGS);

  function render(pose: Pose) {
    const { S, spine, widths } = pose;
    const N = spine.length;
    const xs = spine.map((v) => v.x);
    const ys = spine.map((v) => -v.y); // world y is up
    const heights = widths.map((w, i) => w * HR[i]! * (1 - pose.flat * 0.22));
    const lift = 2.6 * S * (1 - pose.flat);

    // Ring centres: a short snout extension in front of joint 0, then the spine, resampled smoothly.
    const span = N - 1 + 0.35;
    for (let r = 0; r < RINGS; r++) {
      const t = (r / (RINGS - 1)) * span - 0.35;
      const tc = Math.max(0, t);
      let x = cr(xs, tc), y = cr(ys, tc);
      if (t < 0) {
        const dx = xs[0]! - xs[1]!, dy = ys[0]! - ys[1]!;
        const l = Math.hypot(dx, dy) || 1;
        x += (dx / l) * -t * 5 * S;
        y += (dy / l) * -t * 5 * S;
      }
      cx[r] = x;
      cy[r] = y;
      // Round the snout and the tail tip off.
      const nose = t < 0 ? 0.55 + 0.45 * (1 + t / 0.35) : t < 0.6 ? 1 : 1;
      cw[r] = Math.max(0.3, cr(widths, tc) * (t < 0 ? nose * 0.8 : 1));
      ch[r] = Math.max(0.3, cr(heights, tc) * (t < 0 ? nose * 0.8 : 1));
      cz[r] = ch[r]! * 0.62 + lift * Math.min(1, tc / 3 + 0.4) * (tc > 14 ? Math.max(0, 1 - (tc - 14) / 6) : 1);
    }
    for (let r = 0; r < RINGS; r++) {
      const a = Math.max(0, r - 1), b2 = Math.min(RINGS - 1, r + 1);
      let fx = cx[a]! - cx[b2]!, fy = cy[a]! - cy[b2]!;
      const l = Math.hypot(fx, fy) || 1;
      fx /= l;
      fy /= l;
      nx[r] = -fy; // left normal in world axes
      ny[r] = fx;
    }
    for (let r = 0; r < RINGS; r++) {
      for (let k = 0; k <= AROUND; k++) {
        // k=0 right flank, AROUND/4 top, AROUND/2 left flank, 3/4 belly.
        const th = (k / AROUND) * Math.PI * 2;
        const c = -Math.cos(th);
        let s = Math.sin(th);
        if (s < 0) s *= 0.45; // flat belly
        const i = (r * vertsPerRing + k) * 3;
        // Slightly squared cross-section: flat back, rounded flanks.
        const sq = Math.sign(c) * Math.pow(Math.abs(c), 0.8);
        pos[i] = cx[r]! + nx[r]! * cw[r]! * sq;
        pos[i + 1] = cy[r]! + ny[r]! * cw[r]! * sq;
        pos[i + 2] = cz[r]! + ch[r]! * s;
      }
    }
    pos.set([cx[0]!, cy[0]!, cz[0]!, cx[RINGS - 1]!, cy[RINGS - 1]!, cz[RINGS - 1]!], capFront * 3);
    geo.attributes.position!.needsUpdate = true;
    geo.computeVertexNormals();

    // Helpers in joint space.
    const ringOf = (j: number) => Math.round(((j + 0.35) / span) * (RINGS - 1));
    const surf = (j: number, side: number, th: number, out: THREE.Vector3, push = 0) => {
      const r = Math.max(0, Math.min(RINGS - 1, ringOf(j)));
      const c = Math.cos(th);
      const s = Math.sin(th);
      const w = cw[r]! + push;
      out.set(cx[r]! + nx[r]! * side * w * c, cy[r]! + ny[r]! * side * w * c, cz[r]! + ch[r]! * s);
      return r;
    };
    const fwd = (r: number, out: THREE.Vector3) => {
      const a = Math.max(0, r - 1), b2 = Math.min(RINGS - 1, r + 1);
      out.set(cx[a]! - cx[b2]!, cy[a]! - cy[b2]!, 0).normalize();
      return out;
    };

    // Spikes: fringe down the flanks, rows of spiny scales on the back, jowls, and the beard.
    let n = 0;
    const F = new THREE.Vector3();
    const Nn = new THREE.Vector3();
    const dir = new THREE.Vector3();
    for (const side of [1, -1]) {
      for (let j = 6.0; j < 12.8; j += 0.24) {
        const r = surf(j, side, 0.18, tmpB, -0.3 * S);
        fwd(r, F);
        Nn.set(nx[r]! * side, ny[r]! * side, 0);
        dir.copy(Nn).addScaledVector(F, -0.55).add(new THREE.Vector3(0, 0, 0.25));
        const l = (2.3 + ((j * 13) % 1) * 1.2 + pose.flat * 0.6) * S;
        spikeAt(spikes, n++, tmpB, dir, l, 0.75 * S);
      }
      for (let j = 5.6; j < 12.6; j += 0.55) {
        for (const th of [0.95, 1.25]) {
          const r = surf(j + (th > 1 ? 0.27 : 0), side, th, tmpB, -0.4 * S);
          fwd(r, F);
          Nn.set(nx[r]! * side, ny[r]! * side, 0);
          dir.set(0, 0, 1).addScaledVector(Nn, 0.5).addScaledVector(F, -0.35);
          spikeAt(spikes, n++, tmpB, dir, 1.7 * S, 0.7 * S);
        }
      }
      for (let j = 3.0; j < 4.7; j += 0.24) {
        const r = surf(j, side, 0.35, tmpB, -0.4 * S);
        fwd(r, F);
        Nn.set(nx[r]! * side, ny[r]! * side, 0);
        dir.copy(Nn).addScaledVector(F, -0.7).add(new THREE.Vector3(0, 0, 0.35));
        spikeAt(spikes, n++, tmpB, dir, 3.2 * S, 0.9 * S);
      }
      for (let j = 2.4; j < 3.4; j += 0.5) {
        const r = surf(j, side, 1.0, tmpB, -0.5 * S);
        fwd(r, F);
        dir.set(0, 0, 1).addScaledVector(F, -0.6);
        spikeAt(spikes, n++, tmpB, dir, 1.6 * S, 0.6 * S);
      }
    }
    spikes.count = n;
    spikes.instanceMatrix.needsUpdate = true;

    let bn = 0;
    for (const side of [1, -1]) {
      for (let j = 3.5; j < 5.6; j += 0.2) {
        const r = surf(j, side, -0.15, tmpB, -0.3 * S);
        fwd(r, F);
        Nn.set(nx[r]! * side, ny[r]! * side, 0);
        dir.copy(Nn).addScaledVector(F, -0.45).add(new THREE.Vector3(0, 0, -0.1));
        spikeAt(beard, bn++, tmpB, dir, (2.0 + pose.puff * 3) * S, 0.85 * S);
      }
    }
    beard.count = bn;
    beard.instanceMatrix.needsUpdate = true;
    beardMat.color.setRGB(lerp(0.61, 0.12, pose.puff), lerp(0.42, 0.07, pose.puff), lerp(0.23, 0.04, pose.puff), THREE.SRGBColorSpace);

    // Legs: upper limb, forearm and toes as cylinders, rounded joints, dark claws.
    let ln = 0, jn = 0, cn = 0, un = 0;
    for (const leg of pose.legs) {
      const r = ringOf(leg.joint);
      const A = new THREE.Vector3(leg.a.x, -leg.a.y, cz[r]! - ch[r]! * 0.3);
      const footZ = 1.2 * S + leg.lift * 6 * S;
      const E = new THREE.Vector3(leg.e.x, -leg.e.y, Math.max(cz[r]! + ch[r]! * 0.15, footZ + 2 * S) + leg.lift * 3 * S);
      const Ft = new THREE.Vector3(leg.f.x, -leg.f.y, footZ);
      segment(uppers, un, A, E, 3.4 * S);
      segment(lowers, un++, E, Ft, 2.25 * S);
      ballAt(joints, jn++, E, 2.25 * S);
      ballAt(joints, jn++, Ft, 1.85 * S, 1.2 * S);
      for (const tp of leg.toes) {
        const T = new THREE.Vector3(tp.x, -tp.y, 0.9 * S + leg.lift * 6 * S);
        segment(limbs, ln++, Ft, T, 0.75 * S);
        dir.subVectors(T, Ft).normalize();
        dir.z -= 0.25;
        spikeAt(claws, cn++, T, dir, 1.7 * S, 0.42 * S);
      }
      void ln;
    }
    limbs.count = ln;
    uppers.instanceMatrix.needsUpdate = lowers.instanceMatrix.needsUpdate = true;
    joints.count = jn;
    claws.count = cn;
    limbs.instanceMatrix.needsUpdate = joints.instanceMatrix.needsUpdate = claws.instanceMatrix.needsUpdate = true;

    // Eyes under a scaly lid bulge, and nostrils.
    let en = 0;
    for (const side of [1, -1]) {
      surf(2.3, side, 0.62, tmpB, -0.6 * S);
      ballAt(lids, en, tmpB, 2.2 * S, 1.5 * S);
      const o = 0.2 + 0.8 * pose.eyeOpen;
      tmpA.copy(tmpB);
      tmpA.z += 0.9 * S;
      ballAt(eyes, en, tmpA, 1.75 * S * o, 1.2 * S * o);
      surf(0.15, side, 0.75, tmpB, -0.6 * S);
      ballAt(nostrils, en, tmpB, 0.5 * S);
      en++;
    }
    for (const im of [lids, eyes, nostrils]) im.instanceMatrix.needsUpdate = true;

    renderer.render(scene, camera);
  }

  function dispose() {
    renderer.dispose();
    canvas.remove();
  }

  return { render, dispose };
}
