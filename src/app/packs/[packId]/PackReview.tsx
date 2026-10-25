"use client";

import { useCallback, useEffect, useState } from "react";
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

const STAGE_LABEL: Record<PackStage, string> = {
  ingesting: "Reading your App Store listing and reviews…",
  writing_brief: "Working out what your app does…",
  writing_hooks: "Writing hooks and checking them against the rules…",
  review: "",
  error: "Something went wrong.",
};

const FORMAT_LABEL: Record<Hook["format"], string> = {
  pov: "POV",
  problem: "Problem",
  before_after: "Before/after",
  list: "List",
  question: "Question",
};

export function PackReview({ packId }: { packId: string }) {
  const [pack, setPack] = useState<PackState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  if (loadError) return <p role="alert">{loadError}</p>;
  if (!pack) return <p className="muted">Loading…</p>;

  return (
    <>
      <header style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {pack.app?.icon_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pack.app.icon_url} alt="" width={56} height={56} style={{ borderRadius: 12 }} />
        )}
        <h1 style={{ margin: 0 }}>{pack.app?.name ?? "Your pack"}</h1>
      </header>

      {pack.stage === "error" && (
        <p role="alert">
          {STAGE_LABEL.error} {pack.stage_error}
        </p>
      )}
      {pack.stage !== "review" && pack.stage !== "error" && <p className="muted">{STAGE_LABEL[pack.stage]}</p>}

      {pack.stage === "review" && pack.brief_json && (
        <BriefEditor packId={packId} initial={pack.brief_json} />
      )}
      {pack.stage === "review" && pack.hooks_json && (
        <HookPicker packId={packId} hooks={pack.hooks_json} initial={pack.chosen_hooks} />
      )}
    </>
  );
}

async function patch(packId: string, body: unknown): Promise<string | null> {
  const res = await fetch(`/api/packs/${packId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return null;
  return ((await res.json()) as { error?: string }).error ?? "Couldn't save.";
}

function BriefEditor({ packId, initial }: { packId: string; initial: Brief }) {
  const [brief, setBrief] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);

  const lines = (v: string) => v.split("\n").map((s) => s.trim()).filter(Boolean);

  async function save() {
    setStatus("Saving…");
    setStatus((await patch(packId, { brief })) ?? "Saved.");
  }

  return (
    <section>
      <h2>Brief</h2>
      <p className="muted">This is what Trailerly understood. Fix anything that's wrong.</p>
      <div style={{ display: "grid", gap: 12 }}>
        <label>
          What it does
          <textarea rows={2} value={brief.what_it_does} onChange={(e) => setBrief({ ...brief, what_it_does: e.target.value })} />
        </label>
        <label>
          Who it's for
          <textarea rows={2} value={brief.audience} onChange={(e) => setBrief({ ...brief, audience: e.target.value })} />
        </label>
        <label>
          Key features (3 to 5, one per line)
          <textarea rows={5} value={brief.features.join("\n")} onChange={(e) => setBrief({ ...brief, features: lines(e.target.value) })} />
        </label>
        <label>
          Review phrases (one per line, 8 words or fewer)
          <textarea rows={5} value={brief.review_phrases.join("\n")} onChange={(e) => setBrief({ ...brief, review_phrases: lines(e.target.value) })} />
        </label>
        <label>
          Tone
          <input value={brief.tone} onChange={(e) => setBrief({ ...brief, tone: e.target.value })} />
        </label>
        <div>
          <button onClick={save}>Save brief</button> <span className="muted">{status}</span>
        </div>
      </div>
    </section>
  );
}

function HookPicker({ packId, hooks, initial }: { packId: string; hooks: Hook[]; initial: ChosenHooks | null }) {
  const [social, setSocial] = useState<string[]>(initial?.social ?? []);
  const [headline, setHeadline] = useState<string | null>(initial?.headline ?? null);
  const [status, setStatus] = useState<string | null>(null);

  function toggle(text: string) {
    setSocial((cur) =>
      cur.includes(text) ? cur.filter((t) => t !== text) : cur.length < MAX_SOCIAL_HOOKS ? [...cur, text] : cur,
    );
  }

  async function save() {
    setStatus("Saving…");
    setStatus((await patch(packId, { chosen: { social, headline } })) ?? "Saved.");
  }

  return (
    <section>
      <h2>Hooks</h2>
      <p className="muted">
        Pick up to {MAX_SOCIAL_HOOKS} for the social ads ({social.length} picked) and one headline for the App Store videos.
        Every hook here has passed the rules check.
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th align="left">Hook</th>
            <th>Social ad</th>
            <th>Headline</th>
          </tr>
        </thead>
        <tbody>
          {hooks.map((h) => (
            <tr key={h.text} style={{ borderTop: "1px solid var(--border)" }}>
              <td style={{ padding: "8px 0" }}>
                {h.text} <span className="muted">· {FORMAT_LABEL[h.format]}</span>
              </td>
              <td align="center">
                <input
                  type="checkbox"
                  aria-label={`Use "${h.text}" in a social ad`}
                  checked={social.includes(h.text)}
                  disabled={!social.includes(h.text) && social.length >= MAX_SOCIAL_HOOKS}
                  onChange={() => toggle(h.text)}
                />
              </td>
              <td align="center">
                <input
                  type="radio"
                  name="headline"
                  aria-label={`Use "${h.text}" as the headline`}
                  checked={headline === h.text}
                  onChange={() => setHeadline(h.text)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        <button onClick={save}>Save picks</button> <span className="muted">{status}</span>
      </p>
    </section>
  );
}
