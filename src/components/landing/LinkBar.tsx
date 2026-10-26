"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export const PENDING_LINK_KEY = "trailerly:pending-link";

/** Paste a link on the home page. It is kept in sessionStorage so it survives the sign-in redirect, and step 1 fills it in. */
export function LinkBar() {
  const router = useRouter();
  const [link, setLink] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (link.trim()) sessionStorage.setItem(PENDING_LINK_KEY, link.trim());
    } catch {}
    router.push("/packs/new");
  }

  return (
    <section className="wrap" style={{ paddingTop: 28 }}>
      <div className="lp-linkbar">
        <div style={{ flex: "1 1 300px" }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 22 }}>Paste a link, get a pack</h2>
          <p className="mu" style={{ margin: 0 }}>Drafts are free to make and preview. Full-size downloads open soon.</p>
        </div>
        <form onSubmit={submit}>
          <label htmlFor="lp-link" className="sr">App Store link</label>
          <input id="lp-link" type="url" inputMode="url" placeholder="https://apps.apple.com/…" value={link} onChange={(e) => setLink(e.target.value)} />
          <button className="btn btn-primary" type="submit" style={{ minHeight: 58, padding: "0 26px", fontSize: 16, borderRadius: 14 }}>Make my pack</button>
        </form>
      </div>
    </section>
  );
}
