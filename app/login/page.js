"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn(event) {
    event.preventDefault();
    setLoading(true); setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    setMessage(error ? error.message : "Check your email for the secure sign-in link.");
  }

  return <main className="login-page"><form className="login-card" onSubmit={signIn}><span className="brand-mark">B</span><div><span className="eyebrow">Brand Perf Edit</span><h1>Sign in to your workspace</h1><p>Use your team email to access scripts, approvals, videos, and live-status updates.</p></div><label><span>Email address</span><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" /></label><button className="button primary" disabled={loading}>{loading ? "Sending link…" : "Email me a sign-in link"}</button>{message && <p className="login-message">{message}</p>}</form></main>;
}
