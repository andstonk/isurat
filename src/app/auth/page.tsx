"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";

type OAuthProvider = "google" | "github";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState<"email" | OAuthProvider | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading("email"); setMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const supabase = createBrowserSupabase();
    const { data, error } = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
    setLoading(null);
    if (error) return setMessage(error.message);
    if (data.session) { router.push("/dashboard"); router.refresh(); }
    else setMessage("Check your email to confirm your account, then sign in.");
  }

  async function signInWithProvider(provider: OAuthProvider) {
    setLoading(provider);
    setMessage("");
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setLoading(null);
      setMessage(error.message);
    }
  }

  return (
    <main className="auth-page">
      <Link href="/" className="brand"><span className="app-logo">S</span><span>subframe</span></Link>
      <section className="auth-card">
        <span className="section-label">SUBFRAME STUDIO</span>
        <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p>{mode === "login" ? "Sign in to manage your subtitle projects." : "Start generating precise subtitles from MP4 videos."}</p>
        <div className="oauth-buttons">
          <button className="oauth-button" type="button" disabled={loading !== null} onClick={() => signInWithProvider("google")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.4Z"/><path fill="currentColor" opacity=".8" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1a5.8 5.8 0 0 1-5.5-4H3.2v2.6A10 10 0 0 0 12 22Z"/><path fill="currentColor" opacity=".65" d="M6.5 14.1a6 6 0 0 1 0-4.2V7.3H3.2a10 10 0 0 0 0 9.4l3.3-2.6Z"/><path fill="currentColor" opacity=".9" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.7 9.7 0 0 0 3.2 7.3l3.3 2.6a5.8 5.8 0 0 1 5.5-4Z"/></svg>
            {loading === "google" ? "Connecting…" : "Continue with Google"}
          </button>
          <button className="oauth-button" type="button" disabled={loading !== null} onClick={() => signInWithProvider("github")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .7a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.2.8-.5v-2c-3.4.7-4.1-1.4-4.1-1.4-.6-1.4-1.4-1.8-1.4-1.8-1.1-.8.1-.8.1-.8 1.3.1 2 1.3 2 1.3 1.1 2 2.9 1.4 3.5 1.1.1-.8.4-1.4.8-1.7-2.7-.3-5.5-1.3-5.5-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.6.1-3.1 0 0 1-.3 3.2 1.2a11.1 11.1 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.5.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.8 5.4-5.5 5.7.5.4.9 1.1.9 2.2v3.2c0 .3.2.7.8.5A11.5 11.5 0 0 0 12 .7Z"/></svg>
            {loading === "github" ? "Connecting…" : "Continue with GitHub"}
          </button>
        </div>
        <div className="auth-divider"><span>or continue with email</span></div>
        <form onSubmit={submit} className="stack-form">
          <label>Email<input name="email" type="email" autoComplete="email" required /></label>
          <label>Password<input name="password" type="password" minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} required /></label>
          <button className="primary-button" disabled={loading !== null}>{loading === "email" ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
        </form>
        {message && <p className="form-message" role="status">{message}</p>}
        <button className="text-button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setMessage(""); }}>
          {mode === "login" ? "Need an account? Register" : "Already registered? Sign in"}
        </button>
      </section>
    </main>
  );
}