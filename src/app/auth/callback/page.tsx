"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    async function finishSignIn() {
      const supabase = createBrowserSupabase();
      const url = new URL(window.location.href);
      const providerError = url.searchParams.get("error_description") ?? url.searchParams.get("error");

      if (providerError) {
        setError(providerError);
        return;
      }

      const code = url.searchParams.get("code");
      const result = code
        ? await supabase.auth.exchangeCodeForSession(code)
        : await supabase.auth.getSession();

      if (result.error) {
        setError(result.error.message);
        return;
      }

      if (!result.data.session) {
        setError("The sign-in link is invalid or has expired. Please try again.");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    }

    finishSignIn().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Unable to complete sign in.");
    });
  }, [router]);

  return (
    <main className="auth-page">
      <Link href="/" className="brand"><span className="app-logo">S</span><span>subframe</span></Link>
      <section className="auth-card auth-callback-card">
        <span className="section-label">SUBFRAME STUDIO</span>
        <h1>{error ? "Sign-in failed" : "Completing sign in"}</h1>
        <p role="status">{error || "Verifying your account and preparing your dashboard…"}</p>
        {error && <Link className="primary-button" href="/auth">Return to sign in</Link>}
      </section>
    </main>
  );
}