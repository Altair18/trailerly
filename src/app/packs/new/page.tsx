"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LinkIcon } from "@/components/Icons";
import { TopBar } from "@/components/TopBar";

// Journey step 1: paste the App Store link. The recording upload (step 2) arrives in M2.
export default function NewPack() {
  const router = useRouter();
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/packs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ link }),
    });
    const body = (await res.json().catch(() => ({}))) as { packId?: string; error?: string };
    if (res.status === 401) return router.push("/login?next=/packs/new");
    setBusy(false);
    if (!res.ok || !body.packId) return setError(body.error ?? "Something went wrong");
    router.push(`/packs/${body.packId}`);
  }

  return (
    <>
      <TopBar step="Link" />
      <main className="wrap" style={{ paddingTop: 32, paddingBottom: 120 }}>
        <div className="rise" style={{ marginBottom: 24 }}>
          <p className="mu" style={{ margin: "0 0 12px" }}>Step 1 of 8</p>
          <h1 className="disp h1">Paste your App Store link</h1>
        </div>
        <form onSubmit={submit} className="tile rise" style={{ borderRadius: 26, animationDelay: ".08s" }}>
          <div className="kb flow" style={{ backgroundImage: "linear-gradient(120deg,#2EE6A6,#38D9FF,#B8F23A)", opacity: 0.9 }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(0,0,0,.7),rgba(0,0,0,.15) 80%)", zIndex: 1 }} />
          <div style={{ position: "relative", zIndex: 2, padding: "40px 32px", display: "grid", gap: 16, maxWidth: 820 }}>
            <label htmlFor="link" className="lab" style={{ color: "#fff" }}><LinkIcon />App Store link</label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                id="link"
                className="field"
                style={{ flex: "1 1 360px", minHeight: 58, fontSize: 17, background: "rgba(10,10,14,.75)" }}
                placeholder="https://apps.apple.com/gb/app/your-app/id1234567890"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                required
              />
              <button className="btn btn-primary" type="submit" disabled={busy} style={{ minHeight: 58 }}>
                {busy ? "Reading your listing…" : "Read my listing"}
              </button>
            </div>
            <p style={{ margin: 0, color: "#E4E3EC", fontSize: 14 }}>
              We read the name, icon, screenshots, description and recent reviews. Reviewer names are never kept.
            </p>
            {error && <p role="alert" style={{ margin: 0, color: "var(--yel)", fontWeight: 600 }}>{error}</p>}
          </div>
        </form>
      </main>
    </>
  );
}
