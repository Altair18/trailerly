"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
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

  if (state === "sent") return <p>Check your email for a sign-in link.</p>;
  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
      <label>
        Email
        <input type="email" style={{ width: "100%" }} value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <button type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Email me a sign-in link"}</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}

export default function Login() {
  return (
    <main>
      <h1>Sign in</h1>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
