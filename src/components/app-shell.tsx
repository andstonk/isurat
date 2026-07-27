"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  async function signOut() {
    await createBrowserSupabase().auth.signOut();
    router.push("/auth");
    router.refresh();
  }
  return (
    <main className="app-page">
      <header className="app-header">
        <Link href="/dashboard" className="brand"><span className="app-logo">S</span><span>subframe</span></Link>
        <nav><Link href="/dashboard">Projects</Link><Link href="/account">Account</Link><button onClick={signOut}>Sign out</button></nav>
      </header>
      {children}
    </main>
  );
}