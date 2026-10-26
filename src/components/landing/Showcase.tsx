"use client";

import { useRef, useState } from "react";

// Before/after slider: the raw screen recording on the left, the Trailerly render on the right, split by a
// draggable divider. One entry per app, picked with the thumbnails below; the format toggle switches the
// "after" side between the header (21:9) and search (3:2) video.
//
// Until real files are dropped in, each app is drawn as a placeholder mock. To use real footage, set the
// video paths (files in /public/showcase/<app>/) and the mock is skipped for that side.

type Format = "header" | "search";

type App = {
  id: string;
  name: string;
  pitch: string;
  hook: string;
  /** Light-mode UI colours for the mock screen. */
  ui: { accent: string; tint: string };
  /** Backdrop for the mock render. */
  scene: string;
  rows: string[];
  raw?: string; // e.g. "/showcase/<app>/raw.mp4"
  header?: string; // 21:9 render
  search?: string; // 3:2 render
};

const APPS: App[] = [
  {
    id: "plants",
    name: "Sprout",
    pitch: "Plant care reminders",
    hook: "Stop guessing when to water",
    ui: { accent: "#2E9E6A", tint: "#EAF6EF" },
    scene: "radial-gradient(120% 90% at 70% 55%, #1F5B3F 0%, #0C1F17 55%, #07100C 100%)",
    rows: ["Monstera · water today", "Fiddle fig · in 2 days", "Pothos · mist", "Snake plant · fine"],
  },
  {
    id: "notes",
    name: "Nightpad",
    pitch: "Voice notes, sorted",
    hook: "Ideas at 3am, sorted by 9",
    ui: { accent: "#6B4DFF", tint: "#EFEBFF" },
    scene: "radial-gradient(120% 90% at 70% 55%, #3A2A85 0%, #140E33 55%, #08061A 100%)",
    rows: ["App idea: tide alerts", "Call Sam about logo", "Groceries for Sunday", "Book title draft"],
  },
  {
    id: "tides",
    name: "Tideline",
    pitch: "Local tide times",
    hook: "When is high tide, really?",
    ui: { accent: "#1A8FD6", tint: "#E6F4FD" },
    scene: "radial-gradient(120% 90% at 70% 55%, #165A86 0%, #0A2133 55%, #050E16 100%)",
    rows: ["High 14:32 · 4.1 m", "Low 20:47 · 0.8 m", "High 02:51 · 4.3 m", "Sunset 18:04"],
  },
];

const FORMATS: { id: Format; label: string; ratio: string }[] = [
  { id: "header", label: "Header video · 21:9", ratio: "21 / 9" },
  { id: "search", label: "Search video · 3:2", ratio: "3 / 2" },
];

/** The app's screen as a flat capture: no frame, no motion, just the UI. */
function Screen({ app, compact }: { app: App; compact?: boolean }) {
  return (
    <div className={`lp-sc-screen${compact ? " compact" : ""}`} style={{ ["--acc" as string]: app.ui.accent, ["--tint" as string]: app.ui.tint }}>
      <div className="bar"><b>9:41</b><span /></div>
      <small>Today</small>
      <strong>{app.name}</strong>
      <div className="card"><i />{app.pitch}</div>
      <ul>
        {app.rows.map((r, k) => (
          <li key={r}><span className={k < 2 ? "on" : undefined} />{r}</li>
        ))}
      </ul>
    </div>
  );
}

function Video({ src }: { src: string }) {
  return <video className="lp-sc-video" src={src} autoPlay muted loop playsInline preload="metadata" />;
}

export function Showcase() {
  const [appIx, setAppIx] = useState(0);
  const [format, setFormat] = useState<Format>("header");
  const [pos, setPos] = useState(50);
  const stage = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const app = APPS[appIx]!;
  const fmt = FORMATS.find((f) => f.id === format)!;
  const after = format === "header" ? app.header : app.search;

  function moveTo(clientX: number) {
    const r = stage.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  }

  return (
    <section id="before-after" className="wrap lp-sec">
      <div className="lp-head">
        <div>
          <h2 className="disp lp-h2">Raw capture in. Trailer out.</h2>
          <p className="mu">Drag the line to compare a plain screen recording with the video Trailerly makes from it.</p>
        </div>
        <div className="lp-sc-fmt" role="group" aria-label="Video format">
          {FORMATS.map((f) => (
            <button key={f.id} type="button" aria-pressed={format === f.id} onClick={() => setFormat(f.id)}>{f.label}</button>
          ))}
        </div>
      </div>

      <div className="lp-sc">
        <div
          ref={stage}
          className={`lp-sc-stage ${format}`}
          style={{ aspectRatio: fmt.ratio, ["--pos" as string]: `${pos}%` }}
          onPointerDown={(e) => {
            dragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            moveTo(e.clientX);
          }}
          onPointerMove={(e) => dragging.current && moveTo(e.clientX)}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
        >
          {/* Before: the raw recording. */}
          <div className="lp-sc-side raw">
            {app.raw ? <Video src={app.raw} /> : <Screen app={app} />}
          </div>
          {/* After: the render, revealed right of the divider. */}
          <div className="lp-sc-side after" style={{ backgroundImage: after ? undefined : app.scene }}>
            {after ? (
              <Video src={after} />
            ) : (
              <div className={`lp-sc-mock ${format}`}>
                <div className="phone"><Screen app={app} compact /></div>
                <div className="copy">
                  <span className="mono">{app.name}</span>
                  <b className="disp">{app.hook}</b>
                </div>
              </div>
            )}
          </div>
          <span className="lp-sc-label l">Raw capture</span>
          <span className="lp-sc-label r">Trailerly</span>
          <div
            className="lp-sc-handle"
            role="slider"
            tabIndex={0}
            aria-label="Compare raw capture and Trailerly video"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pos)}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 20 : 5;
              if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - step));
              else if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + step));
              else if (e.key === "Home") setPos(0);
              else if (e.key === "End") setPos(100);
              else return;
              e.preventDefault();
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 6-6 6 6 6M15 6l6 6-6 6" />
            </svg>
          </div>
        </div>

        <p className="lp-sc-cap mu">
          {app.raw && after ? `${app.name}: ${app.pitch}.` : "Example. Your app gets its own header and search videos."}
        </p>
        <div className="lp-sc-thumbs" role="group" aria-label="Example apps">
          {APPS.map((a, k) => (
            <button
              key={a.id}
              type="button"
              aria-pressed={k === appIx}
              aria-label={`${a.name}, ${a.pitch}`}
              onClick={() => {
                setAppIx(k);
                setPos(50);
              }}
              style={{ backgroundImage: a.scene }}
            >
              <span className="disp">{a.name}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
