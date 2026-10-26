"use client";

import { Player } from "@remotion/player";
import Link from "next/link";
import { useState } from "react";
import { PageHead } from "@/components/AppLine";
import { TopBar } from "@/components/TopBar";
import { PRICES } from "@/components/landing/pricing";
import { tile } from "@/lib/palette";
import { checkoutProblem, finalsBusy } from "@/lib/payment";
import { DRAFT_SCALE, DRAFT_SPECS, OUTPUT_SPECS, VARIANT_SPECS, type OutputSpecId } from "@/lib/specs/outputs";
import { isOverlay, totalSeconds } from "@/lib/timeline/enforce";
import { TimelineVideo, type TimelineVideoProps } from "@/remotion/compositions/TimelineVideo";
import { type PackState, usePack } from "../usePack";

type Output = PackState["outputs"][number];

const rendering = (o: Output) => o.status === "queued" || o.status === "planning" || o.status === "rendering";
/** Back from Stripe: the webhook can land a moment after the redirect, so keep polling until it does. */
const justPaid = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("paid");
const busy = (p: PackState) => p.outputs.some(rendering) || finalsBusy(p.status) || (p.status === "draft" && justPaid());

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
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const outputs = pack?.outputs ?? [];
  const byId = Object.fromEntries(outputs.map((o) => [o.spec, o])) as Partial<Record<OutputSpecId, Output>>;
  const expected = [...DRAFT_SPECS, ...VARIANT_SPECS.filter((s) => byId[s])];
  const ready = expected.filter((s) => byId[s]?.status === "ready").length;
  const variants = VARIANT_SPECS.filter((s) => byId[s]);
  const selected = byId[open];

  const finals = outputs.flatMap((o) => o.finals);
  const problem = pack ? checkoutProblem(pack.status, outputs, expected) : null;
  // Back from Stripe before its webhook lands: say so, and don't offer the pay button a second time.
  const confirming = pack?.status === "draft" && justPaid();

  async function pay() {
    setPaying(true);
    setPayError(null);
    const res = await fetch("/api/stripe/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ packId }) });
    const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (res.ok && body.url) return window.location.assign(body.url);
    setPayError(body.error ?? "Checkout didn't open. Try again.");
    setPaying(false);
  }

  async function retryFinals() {
    setRetrying(true);
    await fetch(`/api/packs/${packId}/final`, { method: "POST" });
    await reload();
    setRetrying(false);
  }

  async function retry() {
    setRetrying(true);
    await fetch(`/api/packs/${packId}/drafts`, { method: "POST" });
    await reload();
    setRetrying(false);
  }

  return (
    <>
      <TopBar step={pack?.status === "ready" ? "Download" : finalsBusy(pack?.status ?? "draft") ? "Pay" : "Drafts"} />
      <main className="wrap" style={{ paddingTop: 32, paddingBottom: 120 }}>
        {error && <p role="alert">{error}</p>}
        <PageHead app={pack?.app ?? null} step={pack?.status === "ready" ? 8 : 5} title={pack?.status === "ready" ? "Your pack" : "Your drafts"}>
          <div style={{ display: "grid", gap: 8, minWidth: 280 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: "var(--tx)" }}>
              <span>{ready} of {expected.length} ready</span>
            </div>
            <div className="bar"><span style={{ width: `${(ready / expected.length) * 100}%` }} /></div>
            <span style={{ fontSize: 13 }}>
              {pack?.status === "ready" ? "Paid. Full-size files are below." : "Low-resolution and watermarked. Finals render after you pay."}
            </span>
          </div>
        </PageHead>

        {finals.length > 0 && (
          <section id="downloads" className="card rise" style={{ marginTop: 28, display: "grid", gap: 14 }}>
            <div>
              <span className="lab" style={{ color: "var(--lime)" }}><span className="dot" />Your pack</span>
              <p className="disp" style={{ margin: "8px 0 0", fontSize: 32 }}>Full size, no watermark</p>
              <p className="mu" style={{ margin: "6px 0 0", fontSize: 14 }}>Each file is named for its slot in App Store Connect.</p>
            </div>
            {pack?.zip && (
              <a className="btn btn-light" href={pack.zip} style={{ justifySelf: "start" }}>
                Download all (.zip, with a sheet of where each file goes)
              </a>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
              {finals.map((f) => (
                <a key={f.fileName} href={f.url} download={f.fileName} style={{ display: "grid", gap: 4, padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 12, color: "inherit", textDecoration: "none", minWidth: 0 }}>
                  <span style={{ fontWeight: 700 }}>{f.label} ↓</span>
                  <span className="mono mu" style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.fileName}</span>
                </a>
              ))}
            </div>
          </section>
        )}


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

        {variants.length > 0 && (
          <>
            <h2 className="lab mu rise" style={{ margin: "36px 0 6px" }}>Page test set</h2>
            <p className="mu rise" style={{ margin: "0 0 12px", fontSize: 14, maxWidth: 640 }}>
              The same cut with a different hook. Upload A, B and C as treatments in App Store Connect&apos;s Product Page Optimization to see which message wins.
            </p>
            <div className="rise" style={{ display: "grid", gap: 16 }}>
              {(["header", "search"] as const).map((base) => (
                <div key={base} style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  {[base, ...variants.filter((v) => OUTPUT_SPECS[v].variantOf === base)].map((id) => {
                    const o = byId[id];
                    const spec = OUTPUT_SPECS[id];
                    const hook = o?.timeline?.segments.find((s) => s.overlay && s.style !== "caption" && s.style !== "brand")?.text;
                    return (
                      <div key={id} style={{ width: base === "header" ? 300 : 210, flex: "none" }}>
                        <button className={`out${open === id ? " on" : ""}`} type="button" onClick={() => setOpen(id)} aria-label={`Open ${spec.label}`} style={{ aspectRatio: `${spec.width} / ${spec.height}` }}>
                          {o?.status === "ready" && o.draft_url ? <video src={o.draft_url} autoPlay muted loop playsInline /> : <span className="kb flow" style={{ backgroundImage: tile(2) }} />}
                          {o && rendering(o) && (
                            <span className="ov"><span className="pill-tag" style={{ background: "var(--yel)", color: "var(--ink)" }}><span className="spinner" aria-hidden="true" />{STATUS_LABEL[o.status]}</span></span>
                          )}
                        </button>
                        <div className="lbl">
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{spec.variant ?? "A"} · {hook ?? "…"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </>
        )}

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
            {pack && <ActionText status={pack.status} drafting={ready < expected.length} problem={problem} checkout={pack.checkout} error={payError} confirming={confirming} />}
          </span>
          {pack?.status === "draft" && <Link className="btn btn-ghost" href={`/packs/${packId}`}>Back to hooks</Link>}
          {pack?.status === "draft" && pack.checkout && !problem && !confirming && (
            <button className="btn btn-light" type="button" onClick={pay} disabled={paying}>
              {paying ? "Opening checkout…" : `Pay${PRICES.launch ? ` ${PRICES.launch}` : ""} and download`}
            </button>
          )}
          {pack?.status === "failed" && (
            <button className="btn btn-light" type="button" onClick={retryFinals} disabled={retrying}>
              {retrying ? "Retrying…" : "Retry full-size files"}
            </button>
          )}
          {pack?.status === "ready" && <a className="btn btn-light" href={pack.zip ?? "#downloads"}>{pack.zip ? "Download all" : "Download"}</a>}
        </div>
      </main>
    </>
  );
}

function ActionText({ status, drafting, problem, checkout, error, confirming }: {
  status: PackState["status"];
  drafting: boolean;
  problem: string | null;
  checkout: boolean;
  error: string | null;
  confirming: boolean;
}) {
  if (confirming) return <><span className="spinner" aria-hidden="true" /> <b>Confirming your payment…</b></>;
  if (error) return <b style={{ color: "var(--coral)" }}>{error}</b>;
  if (finalsBusy(status)) {
    return (
      <>
        <span className="spinner" aria-hidden="true" /> <b>Payment received.</b> <span className="mu">Rendering your full-size files, usually a few minutes.</span>
      </>
    );
  }
  if (status === "ready") return <><b>Your pack is ready.</b> <span className="mu">Download each file below.</span></>;
  if (status === "failed") return <><b>Some full-size files didn&apos;t render.</b> <span className="mu">You&apos;ve paid, so retrying is free.</span></>;
  if (drafting) return <b>Rendering your drafts…</b>;
  if (problem) return <><b>Drafts ready.</b> <span className="mu">{problem}</span></>;
  if (!checkout) return <><b>Drafts ready.</b> <span className="mu">Checkout opens soon; full-size downloads come with it.</span></>;
  return <><b>Drafts ready.</b> <span className="mu">Pay once to get every file at full size, without the watermark.</span></>;
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
