"use client";

import { useCallback, useEffect, useState } from "react";
import { Close, Down, Up } from "@/components/Icons";
import { type PackStep, TopBar } from "@/components/TopBar";
import { accent, tile } from "@/lib/palette";
import type { Brief } from "@/lib/schemas/brief";
import { type ChosenHooks, type Hook, MAX_SOCIAL_HOOKS } from "@/lib/schemas/hooks";
import type { PackStage } from "@/types/db";

interface PackState {
  stage: PackStage;
  stage_error: string | null;
  brief_json: Brief | null;
  hooks_json: Hook[] | null;
  chosen_hooks: ChosenHooks | null;
  app: { name: string; icon_url: string | null } | null;
}

const PIPELINE: Array<{ stage: PackStage; label: string }> = [
  { stage: "ingesting", label: "Listing and reviews" },
  { stage: "writing_brief", label: "Writing the brief" },
  { stage: "writing_hooks", label: "Writing and checking hooks" },
];

export function PackReview({ packId }: { packId: string }) {
  const [pack, setPack] = useState<PackState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<"brief" | "hooks">("brief");

  const load = useCallback(async () => {
    const res = await fetch(`/api/packs/${packId}`);
    if (!res.ok) return setLoadError(res.status === 404 ? "Pack not found." : "Couldn't load the pack.");
    setPack((await res.json()) as PackState);
  }, [packId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Poll while the pipeline is running.
  useEffect(() => {
    if (!pack || pack.stage === "review" || pack.stage === "error") return;
    const t = setTimeout(load, 2000);
    return () => clearTimeout(t);
  }, [pack, load]);

  const ready = pack?.stage === "review" && pack.brief_json && pack.hooks_json;
  const step: PackStep = ready && view === "hooks" ? "Hooks" : "Brief";

  return (
    <>
      <TopBar step={step} />
      <main className="wrap" style={{ paddingTop: 32, paddingBottom: 120 }}>
        {loadError && <p role="alert">{loadError}</p>}
        {!loadError && !pack && <p className="mu">Loading…</p>}
        {pack && (
          <>
            {!ready && <Progress pack={pack} />}
            {ready && view === "brief" && (
              <BriefEditor packId={packId} app={pack.app} initial={pack.brief_json!} onDone={() => setView("hooks")} />
            )}
            {ready && view === "hooks" && (
              <HookPicker
                packId={packId}
                app={pack.app}
                hooks={pack.hooks_json!}
                initial={pack.chosen_hooks}
                onBack={() => setView("brief")}
              />
            )}
          </>
        )}
      </main>
    </>
  );
}

function AppLine({ app, step }: { app: PackState["app"]; step: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      {app?.icon_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={app.icon_url} alt="" width={28} height={28} style={{ borderRadius: 8 }} />
      ) : (
        <span style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(150deg,#B8F23A,#2EE6A6)" }} />
      )}
      <span style={{ fontWeight: 600 }}>{app?.name ?? "Your app"}</span>
      <span className="mu">· step {step} of 8</span>
    </div>
  );
}

function Progress({ pack }: { pack: PackState }) {
  const current = PIPELINE.findIndex((p) => p.stage === pack.stage);
  return (
    <div className="rise">
      <AppLine app={pack.app} step={3} />
      <h1 className="disp h1" style={{ marginBottom: 24 }}>
        {pack.stage === "error" ? "That didn't work" : "Reading your app"}
      </h1>
      {pack.stage === "error" ? (
        <div className="card" style={{ borderColor: "var(--coral)" }}>
          <span className="lab" style={{ color: "var(--coral)" }}><span className="dot" />Error</span>
          <p style={{ margin: 0 }}>{pack.stage_error ?? "Something went wrong."}</p>
          <a className="btn btn-light" href="/packs/new" style={{ justifySelf: "start" }}>Try another link</a>
        </div>
      ) : (
        <div className="reading" role="status" aria-live="polite">
          {PIPELINE.map((p, i) => (
            <span key={p.stage} className={i < current ? "done" : i === current ? "now" : undefined}>
              {i < current ? "✓" : i === current ? <span className="spinner" aria-hidden="true" /> : null}
              {p.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

async function patch(packId: string, body: unknown): Promise<string | null> {
  const res = await fetch(`/api/packs/${packId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return null;
  return ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn't save.";
}

const TONES = ["Warm", "Calm", "Funny", "Bold", "Expert", "Playful"];
const MAX_TONES = 3;
const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const splitTone = (tone: string) =>
  tone.split(/,|\band\b/i).map((t) => t.trim()).filter(Boolean).map((t) => t[0]!.toUpperCase() + t.slice(1).toLowerCase());

function BriefEditor({ packId, app, initial, onDone }: { packId: string; app: PackState["app"]; initial: Brief; onDone: () => void }) {
  const [brief, setBrief] = useState(initial);
  const [tones, setTones] = useState<string[]>(() => splitTone(initial.tone).slice(0, MAX_TONES));
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toneOptions = [...new Set([...TONES, ...tones])];
  const features = brief.features;
  const setFeatures = (f: string[]) => setBrief({ ...brief, features: f });
  const move = (i: number, d: number) => {
    const f = features.slice();
    [f[i], f[i + d]] = [f[i + d]!, f[i]!];
    setFeatures(f);
  };
  const draftWords = wordCount(draft);

  function addPhrase(e: React.FormEvent) {
    e.preventDefault();
    if (draftWords === 0 || draftWords > 8 || brief.review_phrases.length >= 10) return;
    setBrief({ ...brief, review_phrases: [...brief.review_phrases, draft.trim()] });
    setDraft("");
  }

  async function save() {
    setSaving(true);
    setError(null);
    const cleaned: Brief = { ...brief, features: features.map((f) => f.trim()).filter(Boolean), tone: tones.join(", ") };
    const problem = await patch(packId, { brief: cleaned });
    setSaving(false);
    if (problem) setError(problem);
    else onDone();
  }

  return (
    <>
      <div className="rise" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20, flexWrap: "wrap", marginBottom: 24 }}>
        <div>
          <AppLine app={app} step={3} />
          <h1 className="disp h1">Check the brief</h1>
        </div>
        <p className="mu" style={{ margin: 0, maxWidth: 440, fontSize: 16 }}>
          Written from your listing and reviews. Change anything that&apos;s wrong. Hooks and voiceovers are written from this.
        </p>
      </div>

      <div className="brief-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
        <section className="card rise" style={{ gridColumn: "span 2", animationDelay: ".05s" }}>
          <label htmlFor="what" className="lab" style={{ color: "var(--lime)" }}><span className="dot" />What it does</label>
          <textarea
            id="what"
            className="field"
            rows={2}
            style={{ font: "900 38px/1 var(--display)", fontStretch: "72%", background: "transparent", border: 0, padding: 0, boxShadow: "none" }}
            value={brief.what_it_does}
            onChange={(e) => setBrief({ ...brief, what_it_does: e.target.value })}
          />
        </section>

        <section className="card rise" style={{ animationDelay: ".12s" }}>
          <label htmlFor="who" className="lab" style={{ color: "var(--cyan)" }}><span className="dot" />Who it&apos;s for</label>
          <textarea
            id="who"
            className="field"
            rows={3}
            style={{ fontSize: 18, fontWeight: 600 }}
            value={brief.audience}
            onChange={(e) => setBrief({ ...brief, audience: e.target.value })}
          />
        </section>

        <section className="card rise" style={{ animationDelay: ".18s" }}>
          <span className="lab" style={{ color: "var(--yel)" }} id="tone-label"><span className="dot" />Tone</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} role="group" aria-labelledby="tone-label">
            {toneOptions.map((t) => {
              const on = tones.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  className="pill"
                  aria-pressed={on}
                  onClick={() => setTones(on ? tones.filter((x) => x !== t) : tones.length < MAX_TONES ? [...tones, t] : tones)}
                >
                  {t}
                </button>
              );
            })}
          </div>
          <p className="mu" style={{ margin: 0, fontSize: 14 }}>Pick up to {MAX_TONES}. Voiceovers and captions follow this.</p>
        </section>

        <section className="card rise" style={{ gridColumn: "span 2", animationDelay: ".24s" }}>
          <span className="lab" style={{ color: "var(--orange)" }}>
            <span className="dot" />Key features<span className="aside">{features.length} of 5 · order sets what shows first</span>
          </span>
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {features.map((f, i) => (
              <li key={i} className="feat">
                <span className="k" style={{ background: accent(i) }}>{i + 1}</span>
                <input
                  aria-label={`Feature ${i + 1}`}
                  value={f}
                  onChange={(e) => setFeatures(features.map((x, k) => (k === i ? e.target.value : x)))}
                />
                <button className="ib" type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><Up /></button>
                <button className="ib" type="button" aria-label="Move down" disabled={i === features.length - 1} onClick={() => move(i, 1)}><Down /></button>
                <button className="ib" type="button" aria-label="Remove feature" disabled={features.length <= 3} onClick={() => setFeatures(features.filter((_, k) => k !== i))}><Close /></button>
              </li>
            ))}
          </ol>
          {features.length < 5 && (
            <button className="btn btn-ghost" type="button" onClick={() => setFeatures([...features, ""])} style={{ justifySelf: "start", minHeight: 40, fontSize: 14 }}>
              + Add a feature
            </button>
          )}
        </section>

        <section className="card rise" style={{ gridColumn: "span 2", animationDelay: ".3s" }}>
          <span className="lab" style={{ color: "var(--pink)" }}>
            <span className="dot" />Review phrases<span className="aside">{brief.review_phrases.length} of 10 · 8 words or fewer</span>
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {brief.review_phrases.map((p, i) => (
              <span key={p} className="chip pop" style={{ background: accent(i + 5) }}>
                {p}
                <button
                  type="button"
                  aria-label={`Remove ${p}`}
                  onClick={() => setBrief({ ...brief, review_phrases: brief.review_phrases.filter((_, k) => k !== i) })}
                >
                  <Close size={12} />
                </button>
              </span>
            ))}
            {brief.review_phrases.length === 0 && <span className="mu">No phrase came up in two or more reviews. Add your own.</span>}
            {brief.review_phrases.length < 10 && (
              <form onSubmit={addPhrase} style={{ display: "flex", flex: "1 1 260px" }}>
                <label htmlFor="np" className="sr">Add a phrase</label>
                <input id="np" className="add" placeholder="Add a phrase and press Enter" value={draft} onChange={(e) => setDraft(e.target.value)} />
              </form>
            )}
          </div>
          {draftWords > 8 && (
            <p style={{ margin: 0, fontSize: 14, color: "var(--yel)" }}>That&apos;s {draftWords} words. Keep it to 8 or fewer so it fits on screen.</p>
          )}
          <p className="mu" style={{ margin: 0, fontSize: 14 }}>Real words from reviews make the best hooks. Reviewer names are never used.</p>
        </section>
      </div>

      <div className="actionbar">
        <span style={{ flex: "1 1 260px" }}>
          <b>Looks right?</b> <span className="mu">Your hooks are ready on the next step.</span>
          {error && <span role="alert" style={{ display: "block", color: "var(--coral)" }}>{error}</span>}
        </span>
        <button className="btn btn-primary" type="button" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save and pick hooks"}
        </button>
      </div>
    </>
  );
}

const FORMAT_LABEL: Record<Hook["format"], string> = {
  pov: "POV",
  problem: "Problem",
  before_after: "Before/after",
  list: "List",
  question: "Question",
};
const FILTERS = ["all", "pov", "problem", "before_after", "list", "question"] as const;

function HookPicker({
  packId,
  app,
  hooks,
  initial,
  onBack,
}: {
  packId: string;
  app: PackState["app"];
  hooks: Hook[];
  initial: ChosenHooks | null;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<"ads" | "head">("ads");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [social, setSocial] = useState<string[]>(initial?.social ?? []);
  const [headline, setHeadline] = useState<string | null>(initial?.headline ?? null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggle(text: string) {
    if (mode === "head") return setHeadline(headline === text ? null : text);
    setSocial((cur) =>
      cur.includes(text) ? cur.filter((t) => t !== text) : cur.length < MAX_SOCIAL_HOOKS ? [...cur, text] : cur,
    );
  }

  async function save() {
    setSaving(true);
    const problem = await patch(packId, { chosen: { social, headline } });
    setSaving(false);
    setStatus(problem ?? "Saved. Drafts come in the next phase.");
  }

  const anySelected = mode === "ads" ? social.length > 0 : headline !== null;

  return (
    <>
      <div className="rise" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20, flexWrap: "wrap", marginBottom: 24 }}>
        <div>
          <AppLine app={app} step={4} />
          <h1 className="disp h1">Pick your hooks</h1>
        </div>
        <p className="mu" style={{ margin: 0, maxWidth: 440, fontSize: 16 }}>
          {hooks.length} openers written from your brief and reviews, all passing the rules. Pick up to {MAX_SOCIAL_HOOKS} for social ads, and one headline for the App Store videos.
        </p>
      </div>

      <div className="rise" style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 18, animationDelay: ".08s" }}>
        <div className="seg" role="group" aria-label="What you're picking">
          <button type="button" aria-pressed={mode === "ads"} onClick={() => setMode("ads")}>
            Social ads <span className="ct">{social.length} of {MAX_SOCIAL_HOOKS}</span>
          </button>
          <button type="button" aria-pressed={mode === "head"} onClick={() => setMode("head")}>
            App Store headline <span className="ct">{headline ? 1 : 0} of 1</span>
          </button>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="group" aria-label="Filter by format">
          {FILTERS.map((f) => (
            <button key={f} type="button" className="fil" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : FORMAT_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      <p className="mu rise" style={{ margin: "0 0 18px", fontSize: 14, animationDelay: ".1s" }}>
        {mode === "ads"
          ? "Tap hooks to add them to your social ads. Each picked hook becomes one ad, in the order you pick them."
          : "Tap one hook to use as the headline across the App Store preview, header and search videos."}
      </p>

      <div className="hook-grid">
        {hooks.map((h, i) => {
          if (filter !== "all" && h.format !== filter) return null;
          const adN = social.indexOf(h.text) + 1;
          const isHead = headline === h.text;
          const on = mode === "ads" ? adN > 0 : isHead;
          const cls = on ? (mode === "ads" ? "sel" : "head") : anySelected ? "dim" : "";
          return (
            <button
              key={h.text}
              type="button"
              className={`hook rise ${cls}`}
              aria-pressed={on}
              onClick={() => toggle(h.text)}
              style={{ animationDelay: `${(0.12 + i * 0.05).toFixed(2)}s` }}
            >
              <span className="bgx flow" style={{ backgroundImage: tile(i) }} />
              <span className="txt disp">{h.text}</span>
              <span className="tag">{FORMAT_LABEL[h.format]}</span>
              {adN > 0 && <span className="badge pop" style={{ background: "#fff", bottom: 16 }}>▶ Ad {adN}</span>}
              {isHead && <span className="badge pop" style={{ background: "var(--yel)", bottom: adN > 0 ? 58 : 16 }}>★ Headline</span>}
            </button>
          );
        })}
      </div>

      <div className="actionbar">
        <span style={{ flex: "1 1 260px" }} role="status">
          <b>
            {social.length} {social.length === 1 ? "ad" : "ads"}, {headline ? "1 headline" : "no headline yet"}.
          </b>{" "}
          <span className="mu">
            {status ?? (social.length > 0 && headline ? "Ready to save." : "Pick at least one ad and a headline.")}
          </span>
        </span>
        <button className="btn btn-ghost" type="button" onClick={onBack}>Back to brief</button>
        <button className="btn btn-primary" type="button" onClick={save} disabled={saving || social.length === 0 || !headline}>
          {saving ? "Saving…" : "Save picks"}
        </button>
      </div>
    </>
  );
}
