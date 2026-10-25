"use client";

import { useState } from "react";
import type { ShotList } from "@/lib/schemas/shotlist";
import { RECORDING_TIPS, shotCoverage } from "@/lib/shotlist";
import type { PackState } from "../usePack";

type Clips = NonNullable<PackState["recording"]>["clips"];

/** Before upload: the shots to record and the checks to do first. After: which shots the clips cover. */
export function ShotListPanel({ list, writing, clips }: { list: ShotList | null; writing: boolean; clips: Clips | null }) {
  const [copied, setCopied] = useState(false);

  if (!list) {
    if (!writing) return null;
    return (
      <div className="card rise" style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <span className="spinner" aria-hidden="true" />
        <span>
          <b>Writing your shot list.</b> <span className="mu">It&apos;s built from your brief and ready in a few seconds.</span>
        </span>
      </div>
    );
  }

  const coverage = clips ? shotCoverage(list, clips) : null;
  const found = coverage?.filter((c) => c.clipIds.length > 0).length ?? 0;
  const total = list.shots.reduce((n, s) => n + s.seconds, 0);
  const text = list.shots.map((s, i) => `${i + 1}. ${s.action} (${s.seconds}s)`).join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(`Shots to record\n${text}\n\nBefore you record\n${RECORDING_TIPS.map((t) => `- ${t}`).join("\n")}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="card rise" style={{ display: "grid", gap: 14, marginBottom: 18 }} aria-label="Shot list">
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h2 className="disp" style={{ margin: 0, fontSize: 32 }}>
          {coverage ? `${found} of ${list.shots.length} shots found` : `Record these ${list.shots.length} shots`}
        </h2>
        <span className="mono mu" style={{ fontSize: 12 }}>about {total} s in one take</span>
        {!coverage && (
          <button className="btn btn-ghost" type="button" onClick={copy} style={{ marginLeft: "auto", minHeight: 36 }}>
            {copied ? "Copied" : "Copy list to phone"}
          </button>
        )}
      </div>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
        {list.shots.map((s, i) => {
          const cov = coverage?.[i];
          const missing = cov && cov.clipIds.length === 0;
          return (
            <li
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "28px 1fr auto",
                gap: 12,
                alignItems: "center",
                padding: "10px 12px",
                borderRadius: 12,
                background: "var(--s2)",
                outline: cov ? `1px solid ${missing ? "var(--yel)" : "rgba(46,230,166,.45)"}` : undefined,
              }}
            >
              <span className="mono" style={{ color: cov && !missing ? "var(--mint)" : "var(--mu)" }}>{cov && !missing ? "✓" : String(i + 1).padStart(2, "0")}</span>
              <span>{s.action}</span>
              <span className="mono mu" style={{ fontSize: 12 }}>
                {cov ? (missing ? <b style={{ color: "var(--yel)" }}>Missing</b> : cov.clipIds.map((id) => id.replace("clip_", "Clip ")).join(", ")) : `${s.seconds}s`}
              </span>
            </li>
          );
        })}
      </ol>
      {coverage ? (
        found < list.shots.length && (
          <p className="mu" style={{ margin: 0, fontSize: 14 }}>
            Missing shots aren&apos;t a problem: we build the videos from what you recorded. Record again with them for more variety.
          </p>
        )
      ) : (
        <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,210,63,.1)", color: "var(--yel)", fontSize: 14 }}>
          <b>Before you record:</b> {RECORDING_TIPS.join(" ")}
        </div>
      )}
    </section>
  );
}
