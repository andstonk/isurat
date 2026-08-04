import type { Metadata } from "next";
import Link from "next/link";
import { SharedProjectView } from "@/components/shared-project-view";
import { loadSharedProject } from "@/lib/shared-project";

// Share links resolve per request (expiry, revocation, and a fresh playback SAS URL), so this
// page must never be cached or prerendered.
export const dynamic = "force-dynamic";

// Belt and braces alongside robots.ts: a shared link should not end up in a search index.
export const metadata: Metadata = {
  title: "Shared subtitle project",
  robots: { index: false, follow: false, nocache: true },
};

const UNAVAILABLE = {
  "not-found": { title: "This link isn’t valid", detail: "The link may have been mistyped, or the project it pointed to was deleted." },
  revoked: { title: "This link was turned off", detail: "The project owner revoked access. Ask them for a new link if you still need it." },
  expired: { title: "This link has expired", detail: "Share links can be set to stop working after a while. Ask the owner for a fresh one." },
} as const;

export default async function SharedProjectPage({ params }: { params: Promise<{ token: string }> }) {
  const result = await loadSharedProject((await params).token);
  if (result.status === "ok") return <SharedProjectView project={result.project} />;
  const { title, detail } = UNAVAILABLE[result.status];
  return <main className="app-page">
    <header className="app-header">
      <Link href="/" className="brand"><span className="app-logo">S</span><span>subframe</span></Link>
      <nav><Link href="/auth">Sign in</Link></nav>
    </header>
    <div className="app-container narrow">
      <div className="share-unavailable">
        <span className="section-label">SHARED PROJECT</span>
        <h1>{title}</h1>
        <p>{detail}</p>
        <Link className="primary-button" href="/">Back to subframe</Link>
      </div>
    </div>
  </main>;
}
