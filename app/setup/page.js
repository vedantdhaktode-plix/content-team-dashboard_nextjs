"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ workspaceName: "Creative studio", fullName: "", initials: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event) {
    event.preventDefault(); setLoading(true); setError("");
    const response = await fetch("/api/bootstrap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const payload = await response.json(); setLoading(false);
    if (!response.ok) return setError(payload.error || "Could not create workspace");
    router.replace("/"); router.refresh();
  }
  return <main className="login-page"><form className="login-card" onSubmit={submit}><span className="brand-mark">B</span><div><span className="eyebrow">First-time setup</span><h1>Create your workflow workspace</h1><p>You will become the workspace administrator and can add team members from Supabase.</p></div><label><span>Workspace name</span><input required value={form.workspaceName} onChange={(event) => setForm({ ...form, workspaceName: event.target.value })} /></label><label><span>Your full name</span><input required value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label><label><span>Initials</span><input required maxLength={4} value={form.initials} onChange={(event) => setForm({ ...form, initials: event.target.value })} placeholder="SJ" /></label><button className="button primary" disabled={loading}>{loading ? "Creating…" : "Create workspace"}</button>{error && <p className="login-message error">{error}</p>}</form></main>;
}
