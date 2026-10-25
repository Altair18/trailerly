"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Journey steps 1 and 2: paste link, upload recording.
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
    const body = (await res.json()) as { packId?: string; error?: string };
    setBusy(false);
    if (!res.ok || !body.packId) return setError(body.error ?? "Something went wrong");
    router.push(`/packs/${body.packId}`);
  }

  return (
    <main>
      <h1>New pack</h1>
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <label>
          App Store link
          <input
            style={{ width: "100%" }}
            placeholder="https://apps.apple.com/gb/app/your-app/id1234567890"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            required
          />
        </label>
        <label>
          Screen recording (20 to 60 s, MP4 or MOV) <span className="muted">· coming in the next phase</span>
          {/* TODO(M2): upload to Supabase Storage and create a `sources` row. */}
          <input type="file" accept="video/mp4,video/quicktime" disabled />
        </label>
        <button type="submit" disabled={busy}>{busy ? "Starting…" : "Continue"}</button>
        {error && <p role="alert">{error}</p>}
      </form>
    </main>
  );
}
