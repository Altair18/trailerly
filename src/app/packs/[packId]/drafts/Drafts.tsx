"use client";

import { Player } from "@remotion/player";
import Link from "next/link";
import { useState } from "react";
import { PageHead } from "@/components/AppLine";
import { TopBar } from "@/components/TopBar";
import { tile } from "@/lib/palette";
import { DRAFT_SCALE, DRAFT_SPECS, OUTPUT_SPECS, type OutputSpecId } from "@/lib/specs/outputs";
import { isOverlay, totalSeconds } from "@/lib/timeline/enforce";
import { TimelineVideo, type TimelineVideoProps } from "@/remotion/compositions/TimelineVideo";
import { type PackState, usePack } from "../usePack";

type Output = PackState["outputs"][number];

const rendering = (o: Output) => o.status === "queued" || o.status === "planning" || o.status === "rendering";
const busy = (p: PackState) => p.outputs.some(rendering);

const STATUS_LABEL: Record<Output["status"], string> = {
  queued: "Queued",
  planning: "Planning the cut",
  rendering: "Rendering",
  ready: "Ready",
  failed: "Failed",
};

const COMING: Partial<Record<OutputSpecId, string>> = {};

const SEG_COLOUR = { screen: "var(--seg-screen)", screenshot: "var(--mint)", ai_scene: "var(--seg-ai)", text: "var(--seg-text)", end_card: "var(--seg-end)" } as const;

export function Drafts({ packId }: { packId: string }) {
  const { pack, error, reload } = usePack(packId, busy);
  const [open, setOpen] = useState<OutputSpecId>("preview");
  const [retrying, setRetrying] = useState(false);

  const outputs = pack?.outputs ?? [];
  const byId = Object.fromEntries(outputs.map((o) => [o.spec, o])) as Partial<Record<OutputSpecId, Output>>;
  const ready = DRAFT_SPECS.filter((s) => byId[s]?.status === "ready").length;
  const selected = byId[open];

  async function retry() {
    setRetrying(true);
    await fetch(`/api/packs/${packId}/drafts`, { method: "POST" });
    await reload();
    setRetrying(false);
  }

  return (
    <>
      <TopBar step="Drafts" />
      <main className="wrap" style={{ paddingTop: 32, paddingBottom: 120 }}>
        {error && <p role="alert">{error}</p>}
        <PageHead app={pack?.app ?? null} step={5} title="Your drafts">
          <div style={{ display: "grid", gap: 8, minWidth: 280 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: "var(--tx)" }}>
              <span>{ready} of {DRAFT_SPECS.length} ready</span>
            </div>
            <div className="bar"><span style={{ width: `${(ready / DRAFT_SPECS.length) * 100}%` }} /></div>
            <span style={{ fontSize: 13 }}>Low-resolution and watermarked. Finals render after you pay.</span>
          </div>
        </PageHead>

        <h2 className="lab mu rise" style={{ margin: "22px 0 12px", display: "flex", gap: 10, alignItems: "center" }}>
          App Store
          <span className="pill-tag" style={{ background: "var(--lime)", color: "var(--ink)" }} title="Header and search videos and stills for the iOS 27 App Store">
            iOS 27 ready
          </span>
        </h2>
        <div className="rise" style={{ display: "flex", gap: 18, alignItems: "flex-end", flexWrap: "wrap" }}>
          {(["preview", "header", "search"] as const).map((id, i) => {
            const spec = OUTPUT_SPECS[id];
            const o = byId[id];
            const coming = COMING[id];
            const width = id === "preview" ? 200 : id === "header" ? 460 : 300;
            return (
              <div key={id} style={{ width, flex: "none" }}>
                <button
                  className={`out${open === id ? " on" : ""}`}
                  type="button"
                  disabled={!!coming}
                  onClick={() => setOpen(id)}
                  aria-label={`Open ${spec.label}`}
                  style={{ aspectRatio: `${spec.width} / ${spec.height}` }}
                >
                  {o?.status === "ready" && o.draft_url ? (
                    <video src={o.draft_url} autoPlay muted loop playsInline />
                  ) : (
                    <span className="kb flow" style={{ backgroundImage: tile(i + 1), opacity: coming ? 0.35 : 1 }} />
                  )}
                  {coming && <span className="ov"><span className="pill-tag">{coming}</span></span>}
                  {o && rendering(o) && (
                    <span className="ov">
                      <span className="pill-tag" style={{ background: "var(--yel)", color: "var(--ink)" }}>
                        <span className="spinner" aria-hidden="true" />
                        {STATUS_LABEL[o.status]}
                      </span>
                    </span>
                  )}
                  {o?.status === "failed" && (
                    <span className="ov" style={{ background: "rgba(60,8,20,.72)" }}>
                      <span className="pill-tag" style={{ background: "var(--coral)", color: "var(--ink)" }}>✕ Failed</span>
                    </span>
                  )}
                </button>
                <div className="lbl">
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{spec.label}</span>
                  <span className="mono mu" style={{ fontSize: 11 }}>{spec.width}×{spec.height}</span>
                </div>
              </div>
            );
          })}
        </div>

        <h2 className="lab mu rise" style={{ margin: "36px 0 12px" }}>Social ads</h2>
        <div className="rise" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(120px, 1fr))", gap: 18, overflowX: "auto" }}>
          {(["social_1", "social_2", "social_3", "social_4", "social_5"] as const).map((id, i) => (
            <div key={id}>
              <button className="out" type="button" disabled aria-label={`${OUTPUT_SPECS[id].label}, coming in phase 5`} style={{ aspectRatio: "9 / 16" }}>
                <span className="kb flow" style={{ backgroundImage: tile(i + 4), opacity: 0.35 }} />
                <span className="ov"><span className="pill-tag">Phase 5</span></span>
              </button>
              <div className="lbl"><span style={{ fontWeight: 700, fontSize: 14 }}>{OUTPUT_SPECS[id].label}</span></div>
            </div>
          ))}
        </div>

        {selected && (
          <Detail
            output={selected}
            clips={pack?.recording?.clips ?? []}
            images={pack?.images ?? {}}
            brand={pack?.app ? { name: pack.app.name, iconUrl: pack.app.icon_url } : undefined}
            onRetry={retry}
            retrying={retrying}
          />
        )}

        <div className="actionbar">
          <span style={{ flex: "1 1 260px" }}>
            <b>{ready === DRAFT_SPECS.length ? "Drafts ready." : "Rendering your drafts…"}</b>{" "}
            <span className="mu">Rules, payment and download arrive in the next phases.</span>
          </span>
          <Link className="btn btn-ghost" href={`/packs/${packId}`}>Back to hooks</Link>
        </div>
      </main>
    </>
  );
}

function Detail({
  output,
  clips,
  images,
  brand,
  onRetry,
  retrying,
}: {
  output: Output;
  clips: Array<{ id: string; url: string }>;
  images: Record<string, string>;
  brand?: { name: string; iconUrl: string | null };
  onRetry: () => void;
  retrying: boolean;
}) {
  const spec = OUTPUT_SPECS[output.spec];
  const timeline = output.timeline;
  const total = timeline ? totalSeconds(timeline) : 0;
  const w = Math.round(spec.width * DRAFT_SCALE / 2) * 2;
  const h = Math.round(spec.height * DRAFT_SCALE / 2) * 2;

  return (
    <section className="card rise" style={{ marginTop: 36, gridTemplateColumns: "minmax(0, 300px) minmax(0, 1fr)", gap: 28, alignItems: "start" }}>
      <div className="player-box" style={{ aspectRatio: `${spec.width} / ${spec.height}` }}>
        {output.status === "ready" && output.draft_url ? (
          // The rendered file is what ships: play it once it exists. The live preview is only for while it renders.
          <video src={output.draft_url} controls autoPlay muted loop playsInline style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }} />
        ) : timeline ? (
          <Player
            component={TimelineVideo}
            inputProps={
              {
                timeline,
                clipUrls: Object.fromEntries(clips.map((c) => [c.id, c.url])),
                imageUrls: images,
                brand,
                watermark: true,
                loop: spec.loop,
                baseWidth: spec.width,
                baseHeight: spec.height,
                safeArea: spec.safeArea,
              } satisfies TimelineVideoProps
            }
            durationInFrames={Math.max(1, Math.round(total * spec.fps))}
            fps={spec.fps}
            compositionWidth={w}
            compositionHeight={h}
            style={{ width: "100%", height: "100%" }}
            controls
            loop
          />
        ) : (
          <span className="spinner" style={{ width: 32, height: 32, borderWidth: 4 }} aria-label="Planning" />
        )}
      </div>

      <div style={{ display: "grid", gap: 18, minWidth: 0 }}>
        <div>
          <span className="lab" style={{ color: "var(--cyan)" }}><span className="dot" />{spec.label}</span>
          <p className="disp" style={{ margin: "8px 0 0", fontSize: 40 }}>{STATUS_LABEL[output.status]}</p>
          {output.error && <p style={{ margin: "6px 0 0", color: "var(--coral)" }}>{output.error}</p>}
          {output.status === "failed" && (
            <button className="btn btn-light" type="button" onClick={onRetry} disabled={retrying} style={{ marginTop: 12 }}>
              {retrying ? "Retrying…" : "Retry"}
            </button>
          )}
        </div>

        {timeline && (
          <div style={{ display: "grid", gap: 8 }}>
            <span className="lab mu">Timeline · {total.toFixed(1)} s</span>
            <div className="tl" aria-label="Overlays">
              {timeline.segments.filter(isOverlay).map((s, i) => (
                <span key={i} className="seg-block" style={{ left: `${(s.start / total) * 100}%`, width: `${(s.duration / total) * 100}%`, background: SEG_COLOUR.text }} title={s.text}>T {s.text ?? s.style}</span>
              ))}
            </div>
            <div className="tl" aria-label="Segments">
              {timeline.segments.filter((s) => !isOverlay(s)).map((s, i) => (
                <span key={i} className={`seg-block${s.type === "ai_scene" ? " ai" : ""}`} style={{ left: `${(s.start / total) * 100}%`, width: `${(s.duration / total) * 100}%`, background: SEG_COLOUR[s.type] }}>
                  {s.type === "screen" ? `▯ ${s.clip_id?.replace("clip_", "Clip ")}` : s.type === "screenshot" ? `▣ ${s.image_id?.replace("shot_", "Shot ")}` : s.type}
                </span>
              ))}
            </div>
          </div>
        )}

        {output.stills.length > 0 && (
          <div style={{ display: "grid", gap: 8 }}>
            <span className="lab mu">Stills for iOS 27</span>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {output.stills.map((still) => (
                <a key={still.id} href={still.url} download={still.fileName} target="_blank" rel="noreferrer" style={{ display: "grid", gap: 6, width: 200, color: "inherit", textDecoration: "none" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={still.url} alt={still.label} style={{ width: "100%", borderRadius: 10, border: "1px solid var(--line)" }} />
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{still.label} ↓</span>
                  <span className="mono mu" style={{ fontSize: 11 }}>PNG · {still.size} in the final pack</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {output.rules.length > 0 && (
          <div style={{ display: "grid", gap: 8 }}>
            <span className="lab mu">Rules</span>
            {output.rules.map((r) => (
              <div key={r.rule} className={`rule ${r.result}`}>
                <span className="ic">{r.result === "pass" ? "✓" : r.result === "warn" ? "!" : "⊘"}</span>
                <b>{r.result === "pass" ? "Pass" : r.result === "warn" ? "Warn" : "Block"}</b>
                <span>{RULE_LABEL[r.rule] ?? r.rule}{r.detail && r.result !== "pass" ? `: ${r.detail}` : ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

const RULE_LABEL: Record<string, string> = {
  preview_no_ai_scene: "Screen capture only, no AI scenes",
  preview_screenshots: "Real footage, not screenshots",
  length_in_spec: "Length in spec",
  no_prices: "No prices or offers",
  no_superlatives: "No rankings or awards",
  no_other_platforms: "No other platforms named",
  ai_scenes_labelled: "AI label",
  no_first_person_results: "No first-person results",
  no_real_people_in_prompts: "No real people",
  age_rating_4_plus: "Suitable for 4+",
};
