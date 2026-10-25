"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { supabaseBrowser } from "@/lib/supabase/browser";

function LoginForm() {
  const next = useSearchParams().get("next") ?? "/packs/new";
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    const redirect = new URL("/auth/callback", window.location.origin);
    redirect.searchParams.set("next", next);
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirect.toString() },
    });
    if (error) {
      setError(error.message);
      setState("idle");
    } else {
      setState("sent");
    }
  }

  if (state === "sent") {
    return (
      <div className="card rise">
        <span className="lab" style={{ color: "var(--lime)" }}><span className="dot" />Link sent</span>
        <p className="disp" style={{ margin: 0, fontSize: 36 }}>Check your email</p>
        <p className="mu" style={{ margin: 0 }}>We sent a sign-in link to {email}. Open it on this device.</p>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="card rise" style={{ gap: 16 }}>
      <label htmlFor="email" className="lab" style={{ color: "var(--cyan)" }}><span className="dot" />Email</label>
      <input id="email" className="field" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <button className="btn btn-primary" type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Email me a sign-in link"}
      </button>
      {error && <p role="alert" style={{ margin: 0, color: "var(--coral)" }}>{error}</p>}
    </form>
  );
}

export default function Login() {
  return (
    <>
      <TopBar />
      <main className="wrap" style={{ paddingTop: 48, paddingBottom: 80, maxWidth: 560 }}>
        <h1 className="disp h1 rise" style={{ marginBottom: 24 }}>Sign in</h1>
        <Suspense>
          <LoginForm />
        </Suspense>
      </main>
    </>
  );
}
