"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { PageHead } from "@/components/AppLine";
import { TopBar } from "@/components/TopBar";
import { MAX_RECORDING_SECONDS, MIN_RECORDING_SECONDS } from "@/lib/media/clips";
import { accent } from "@/lib/palette";
import { type PackState, usePack } from "../usePack";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** Read a video file's length in the browser before uploading it. */
function readDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(v.src);
      resolve(v.duration);
    };
    v.onerror = () => reject(new Error("That file can't be read as a video."));
    v.src = URL.createObjectURL(file);
  });
}

/** PUT the file to the signed upload URL, reporting progress (fetch can't). */
function put(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", file.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    xhr.send(file);
  });
}

const busy = (p: PackState) => p.recording?.status === "preparing" || p.recording?.status === "uploading";

export function RecordingUpload({ packId }: { packId: string }) {
  const { pack, error: loadError, reload } = usePack(packId, busy);
  const [progress, setProgress] = useState<number | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; seconds: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setError(null);
      const type = file.type || (file.name.toLowerCase().endsWith(".mov") ? "video/quicktime" : "video/mp4");
      if (!["video/mp4", "video/quicktime"].includes(type)) return setError("Upload an MP4 or MOV file.");
      try {
        const seconds = await readDuration(file);
        if (seconds < MIN_RECORDING_SECONDS || seconds > MAX_RECORDING_SECONDS) {
          return setError(`That recording is ${Math.round(seconds)} seconds. Trim it to ${MIN_RECORDING_SECONDS} to ${MAX_RECORDING_SECONDS} seconds and try again.`);
        }
        setFileInfo({ name: file.name, seconds });
        setProgress(0);
        const res = await fetch(`/api/packs/${packId}/recording`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ fileName: file.name, contentType: type, durationS: seconds }),
        });
        const body = (await res.json()) as { sourceId?: string; uploadUrl?: string; error?: string };
        if (!res.ok || !body.uploadUrl) throw new Error(body.error ?? "Couldn't start the upload.");
        await put(body.uploadUrl, new File([file], file.name, { type }), setProgress);
        await fetch(`/api/packs/${packId}/recording/${body.sourceId}`, { method: "POST" });
        setProgress(null);
        await reload();
      } catch (e) {
        setProgress(null);
        setError((e as Error).message);
      }
    },
    [packId, reload],
  );

  const rec = pack?.recording;
  const state = progress !== null ? "uploading" : rec?.status === "preparing" ? "preparing" : rec?.status === "ready" ? "done" : "empty";

  return (
    <>
      <TopBar step="Recording" />
      <main className="wrap" style={{ paddingTop: 32, paddingBottom: 120 }}>
        {loadError && <p role="alert">{loadError}</p>}
        <PageHead app={pack?.app ?? null} step={2} title="Add a screen recording">
          {MIN_RECORDING_SECONDS} to {MAX_RECORDING_SECONDS} seconds of the app in use. Every video in your pack is cut from this one file.
        </PageHead>

        {(state === "empty" || rec?.status === "error") && (
          <Dropzone onFile={upload} error={error ?? (rec?.status === "error" ? rec.error : null)} />
        )}

        {(state === "uploading" || state === "preparing") && (
          <div className="tile rise" style={{ borderRadius: 26, minHeight: 420, display: "flex", alignItems: "center" }}>
            <div className="kb flow" style={{ backgroundImage: "linear-gradient(120deg,#1E1033,#101015,#0B2A2A)" }} />
            <div style={{ position: "relative", zIndex: 2, width: "100%", padding: 48, display: "grid", gap: 26 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
                <div className="bob" style={{ width: 80, height: 150, borderRadius: 18, background: "#050507", padding: 4, flex: "none" }}>
                  <div className="flow" style={{ height: "100%", borderRadius: 14, backgroundImage: "linear-gradient(180deg,#B8F23A,#2EE6A6,#38D9FF)" }} />
                </div>
                <div style={{ flex: "1 1 240px" }}>
                  <h2 className="disp" style={{ margin: "0 0 6px", fontSize: 48 }}>{state === "uploading" ? "Uploading" : "Finding clips"}</h2>
                  <p className="mu" style={{ margin: 0 }}>
                    {fileInfo?.name ?? rec?.file_name} · {fmt(fileInfo?.seconds ?? rec?.duration_s ?? 0)}
                  </p>
                </div>
                {state === "uploading" && <span className="disp" style={{ fontSize: 72, color: "var(--yel)" }}>{progress}%</span>}
                {state === "preparing" && <span className="spinner" style={{ width: 40, height: 40, borderWidth: 4 }} aria-label="Working" />}
              </div>
              <div className="bar" role="progressbar" aria-valuenow={state === "uploading" ? progress ?? 0 : 100}>
                <span style={{ width: `${state === "uploading" ? progress : 100}%` }} className={state === "preparing" ? "flow" : undefined} />
              </div>
              <div className="reading">
                <span className={state === "uploading" ? "now" : "done"}>{state === "uploading" ? "1 · Uploading" : "✓ Uploaded"}</span>
                <span className={state === "preparing" ? "now" : undefined}>2 · Finding clips</span>
                <span>3 · Ready</span>
              </div>
            </div>
          </div>
        )}

        {state === "done" && rec && (
          <div className="tile rise" style={{ borderRadius: 26, padding: 32, display: "grid", gap: 26 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <span className="mono" style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", padding: "6px 10px", borderRadius: 8, background: "var(--lime)", color: "var(--ink)" }}>
                {rec.clips.length} clips found
              </span>
              <b style={{ fontSize: 17 }}>{rec.file_name}</b>
              <span className="mu">{Math.round(rec.duration_s ?? 0)} seconds</span>
              <label className="btn btn-ghost" style={{ marginLeft: "auto", minHeight: 40 }}>
                Replace
                <input className="sr" type="file" accept="video/mp4,video/quicktime" onChange={(e) => upload(e.target.files?.[0])} />
              </label>
            </div>
            <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 6 }}>
              {rec.clips.map((c, i) => (
                <figure key={c.id} className="clip pop" style={{ margin: 0, animationDelay: `${0.1 + i * 0.1}s` }}>
                  <div className="clip-thumb" style={{ outlineColor: accent(i) }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.poster} alt="" />
                    <span className="num" style={{ background: accent(i) }}>{i + 1}</span>
                    <span className="dur mono">{fmt(c.duration)}</span>
                    {c.notes?.personal_info && (
                      <span className="mono" title={c.notes.blurred ? `Blurred: ${c.notes.privacy_note ?? "personal data"}` : c.notes.privacy_note ?? "Personal data"} style={{ position: "absolute", top: 8, right: 8, fontSize: 11, fontWeight: 700, padding: "3px 6px", borderRadius: 6, background: c.notes.blurred ? "var(--yellow, #FFE135)" : "var(--coral)", color: "var(--ink)" }}>
                        {c.notes.blurred ? "BLURRED" : "PRIVATE"}
                      </span>
                    )}
                  </div>
                  {c.notes && (
                    <figcaption style={{ fontSize: 13, marginTop: 8, lineHeight: 1.3 }}>
                      <b>{c.notes.label}</b>
                      <span className="mu" style={{ display: "block" }}>{"★".repeat(c.notes.interest)}{"☆".repeat(5 - c.notes.interest)}</span>
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 4, height: 40 }} aria-label={`Clip timeline, ${Math.round(rec.duration_s ?? 0)} seconds`}>
                {rec.clips.map((c, i) => (
                  <span key={c.id} style={{ flex: c.duration, borderRadius: 8, background: accent(i) }} />
                ))}
              </div>
              <div className="mono mu" style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span>0:00</span>
                <span>{fmt(rec.duration_s ?? 0)}</span>
              </div>
            </div>
            {rec.clips.some((c) => c.notes?.personal_info && !c.notes.blurred) && (
              <div role="alert" style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(255,90,78,.12)", border: "1px solid var(--coral)", fontSize: 14 }}>
                <b>Some clips show personal data</b> ({rec.clips.filter((c) => c.notes?.personal_info && !c.notes.blurred).map((c) => c.notes?.privacy_note || c.id).join("; ")}).
                We&apos;ll leave them out where we can. For the cleanest result, record again with demo data and notifications off.
              </div>
            )}
            {rec.clips.some((c) => c.notes?.blurred) && (
              <p className="mu" style={{ margin: 0, fontSize: 14 }}>
                We blurred the personal data we spotted in clips marked <b>BLURRED</b>. Check them before you use the videos; recording with demo data is still the safest.
              </p>
            )}
            <p className="mu" style={{ margin: 0, fontSize: 14 }}>
              We split at screen changes and trim your phone&apos;s status and gesture bars. The App Store preview uses only these clips, never AI scenes.
            </p>
            {error && <p role="alert" style={{ margin: 0, color: "var(--coral)" }}>{error}</p>}
          </div>
        )}

        <div className="actionbar">
          <span style={{ flex: "1 1 260px" }}>
            <b>{state === "done" ? "Recording ready." : "No recording yet."}</b>{" "}
            <span className="mu">{state === "done" ? "Next, check the brief and pick your hooks." : "You can check the brief while it uploads."}</span>
          </span>
          <Link className="btn btn-primary" href={`/packs/${packId}`}>Check the brief</Link>
        </div>
      </main>
    </>
  );
}

function Dropzone({ onFile, error }: { onFile: (f: File | undefined) => void; error: string | null }) {
  const [over, setOver] = useState(false);
  return (
    <div
      className="tile rise"
      style={{ borderRadius: 26, padding: 3 }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFile(e.dataTransfer.files[0]);
      }}
    >
      <div className={`ring${over ? " on" : ""}`} aria-hidden="true" />
      <div style={{ position: "relative", borderRadius: 23, background: "#0A0A0E", minHeight: 460, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 18, padding: "40px 24px" }}>
        <div className="bob" aria-hidden="true" style={{ width: 120, height: 230, borderRadius: 26, border: "3px dashed #4A4A55", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
          <span className="rec" />
        </div>
        <h2 className="disp" style={{ margin: 0, fontSize: "clamp(36px, 6vw, 56px)" }}>Drop your recording here</h2>
        <p className="mu" style={{ margin: 0, fontSize: 16 }}>MP4 or MOV · {MIN_RECORDING_SECONDS} to {MAX_RECORDING_SECONDS} seconds · portrait</p>
        <label className="btn btn-primary" style={{ minHeight: 52, fontSize: 16, padding: "0 26px" }}>
          Choose a file
          <input className="sr" type="file" accept="video/mp4,video/quicktime" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {error && <p role="alert" style={{ margin: 0, color: "var(--yel)", fontWeight: 600, maxWidth: 520 }}>{error}</p>}
      </div>
    </div>
  );
}
