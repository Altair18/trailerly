"use client";

import { useState } from "react";
import { Play } from "./Play";

type Kind = "appstore" | "social";

// Placeholder examples for fictional apps. Swap in real renders before launch.
const EXAMPLES: { app: string; hook: string; where: string; kind: Kind; len: string; bg: string; icon: string }[] = [
  { app: "Fernly", hook: "Stop guessing when to water", where: "App Store preview", kind: "appstore", len: "0:28", bg: "linear-gradient(180deg,#B8F23A,#2EE6A6)", icon: "#2EE6A6" },
  { app: "Quillnote", hook: "Stop losing ideas in the shower", where: "TikTok", kind: "social", len: "0:21", bg: "linear-gradient(180deg,#38D9FF,#9D7BFF)", icon: "#9D7BFF" },
  { app: "Tidekeeper", hook: "When is high tide, really?", where: "App Store preview", kind: "appstore", len: "0:24", bg: "linear-gradient(180deg,#FFE135,#FF7A1A)", icon: "#FF7A1A" },
  { app: "Fernly", hook: "Crispy fern in March. Jungle by June.", where: "Reels", kind: "social", len: "0:18", bg: "linear-gradient(180deg,#FF2E88,#FF7A1A)", icon: "#2EE6A6" },
  { app: "Lumo", hook: "See where your money goes", where: "App Store preview", kind: "appstore", len: "0:26", bg: "linear-gradient(180deg,#9D7BFF,#FF2E88)", icon: "#FFE135" },
  { app: "Quillnote", hook: "Voice notes become tidy text", where: "App Store preview", kind: "appstore", len: "0:22", bg: "linear-gradient(180deg,#2EE6A6,#38D9FF)", icon: "#9D7BFF" },
  { app: "Tidekeeper", hook: "POV: you never miss a sunrise swim", where: "Shorts", kind: "social", len: "0:20", bg: "linear-gradient(180deg,#FF5A4E,#FFE135)", icon: "#FF7A1A" },
  { app: "Lumo", hook: "Is your budget secretly leaking?", where: "Reels", kind: "social", len: "0:23", bg: "linear-gradient(180deg,#FFE135,#B8F23A)", icon: "#FFE135" },
  { app: "Fernly", hook: "Every plant, one tiny reminder", where: "App Store preview", kind: "appstore", len: "0:17", bg: "linear-gradient(180deg,#38D9FF,#B8F23A)", icon: "#2EE6A6" },
  { app: "Lumo", hook: "From overdraft to savings goal", where: "TikTok", kind: "social", len: "0:25", bg: "linear-gradient(180deg,#FF7A1A,#9D7BFF)", icon: "#FFE135" },
];

const FILTERS: { id: Kind | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "appstore", label: "App Store" },
  { id: "social", label: "Social ads" },
];

export function ExampleGrid() {
  const [filter, setFilter] = useState<Kind | "all">("all");
  const shown = EXAMPLES.filter((e) => filter === "all" || e.kind === filter);

  return (
    <section id="explore" className="wrap lp-sec">
      <div className="lp-head">
        <div>
          <h2 className="disp lp-h2">Made with Trailerly</h2>
          <p className="mu">Sample packs for made-up apps, to show the style. Real customer renders will replace them.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} role="group" aria-label="Filter examples">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`btn lp-fil ${filter === f.id ? "btn-light" : "btn-ghost"}`}
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="lp-grid">
        {shown.map((ex) => (
          <figure key={ex.app + ex.hook}>
            <div className="lp-tile" style={{ aspectRatio: "9 / 16" }} role="img" aria-label={`${ex.app} sample: ${ex.hook}`}>
              <div className="kb flow" style={{ backgroundImage: ex.bg }} />
              <div style={{ position: "absolute", left: 14, right: 14, top: 18, zIndex: 2 }}>
                <span className="disp" style={{ fontSize: 26, color: "var(--ink)" }}>{ex.hook}</span>
              </div>
              <Play />
              <div className="lp-cap" style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                {ex.kind === "social" ? <span className="lp-badge">Coming soon</span> : <span />}
                <span className="lp-badge">{ex.len}</span>
              </div>
            </div>
            <figcaption>
              <span style={{ width: 22, height: 22, borderRadius: 6, background: ex.icon, flex: "none" }} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>{ex.app}</span>
              <span className="mu" style={{ fontSize: 13, marginLeft: "auto" }}>{ex.where}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
