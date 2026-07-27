"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createBrowserSupabase } from "@/lib/supabase";

export default function AccountPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => { createBrowserSupabase().auth.getUser().then(({ data }) => data.user ? setEmail(data.user.email ?? "") : router.push("/auth")); }, [router]);
  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    const password = String(new FormData(event.currentTarget).get("password"));
    const { error } = await createBrowserSupabase().auth.updateUser({ password });
    setMessage(error?.message ?? "Password updated.");
    if (!error) event.currentTarget.reset();
  }
  return <AppShell><div className="app-container narrow"><span className="section-label">ACCOUNT</span><h1>Manage account</h1><section className="settings-card"><label>Email<input value={email} disabled /></label><form onSubmit={updatePassword} className="stack-form"><label>New password<input name="password" type="password" minLength={8} required /></label><button className="primary-button">Update password</button></form>{message && <p className="form-message">{message}</p>}</section></div></AppShell>;
}