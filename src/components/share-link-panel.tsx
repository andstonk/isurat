"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ShareLink = {
  id: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
  state: "active" | "revoked" | "expired";
};

const EXPIRY_CHOICES = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "No expiry", days: null },
] as const;

/**
 * Read-only share links for one project. The raw token is returned by the API exactly once, so the
 * freshly created URL is held in component state and can never be listed again — revoke and
 * re-create is the only recovery if a viewer loses it.
 */
export function ShareLinkPanel({ videoId, getToken, onClose }: {
  videoId: string;
  getToken: () => Promise<string | undefined>;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [expiryDays, setExpiryDays] = useState<number | null>(7);
  const [newUrl, setNewUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Loading share links…");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  const authFetch = useCallback(async (path: string, init?: RequestInit) =>
    fetch(path, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${await getToken()}` } }), [getToken]);

  const loadLinks = useCallback(async () => {
    const response = await authFetch(`/api/videos/${videoId}/share`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(data.error ?? "Could not load share links.");
    setLinks(data.links ?? []);
    setMessage("");
  }, [authFetch, videoId]);

  useEffect(() => { void loadLinks(); }, [loadLinks]);

  async function createLink() {
    setBusy(true);
    setMessage("Creating share link…");
    const response = await authFetch(`/api/videos/${videoId}/share`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expiresInDays: expiryDays }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setNewUrl(`${window.location.origin}${data.path}`);
      await loadLinks();
      setMessage("Link created. Copy it now — it is not shown again.");
    } else setMessage(data.error ?? "Could not create a share link.");
    setBusy(false);
  }

  async function revoke(link: ShareLink) {
    if (!window.confirm("Turn off this link? Anyone using it loses access immediately.")) return;
    setBusy(true);
    const response = await authFetch(`/api/videos/${videoId}/share/${link.id}`, { method: "DELETE" });
    if (response.ok) { setNewUrl(""); await loadLinks(); setMessage("Link revoked."); }
    else setMessage((await response.json().catch(() => ({}))).error ?? "Could not revoke that link.");
    setBusy(false);
  }

  async function copy() {
    try { await navigator.clipboard.writeText(newUrl); setMessage("Link copied to the clipboard."); }
    catch { setMessage("Copy failed — select the link and copy it manually."); }
  }

  return <dialog ref={dialogRef} className="font-library-dialog" aria-labelledby="share-links-title" onCancel={onClose}>
    <div className="font-library-header"><div><span className="section-label">SHARING</span><h2 id="share-links-title">Read-only links</h2></div><button type="button" className="dialog-close" aria-label="Close sharing" onClick={onClose}>×</button></div>
    <p>Anyone with the link can watch this video and read its subtitles. They cannot edit, export, or see your other projects, and they do not need an account.</p>
    <div className="font-upload-form share-create-form">
      <div className="share-expiry"><span>Link expires after</span><div className="share-expiry-options">{EXPIRY_CHOICES.map((choice) => <button key={choice.label} type="button" className={expiryDays === choice.days ? "active" : ""} disabled={busy} onClick={() => setExpiryDays(choice.days)}>{choice.label}</button>)}</div></div>
      <div className="font-upload-actions"><span>{expiryDays === null ? "Stays active until you revoke it" : `Stops working ${expiryDays} days from now`}</span><button type="button" className="primary-button small" disabled={busy} onClick={createLink}>Create link</button></div>
    </div>
    {newUrl && <div className="share-new-link"><input readOnly value={newUrl} aria-label="New share link" onFocus={(event) => event.currentTarget.select()} /><button type="button" className="secondary-button small" onClick={copy}>Copy</button></div>}
    <div className="font-library-list">
      {links.length ? links.map((link) => <article key={link.id}>
        <div>
          <b>Link created {new Date(link.created_at).toLocaleDateString()}</b>
          <small>
            {link.state === "active" ? link.expires_at ? `Expires ${new Date(link.expires_at).toLocaleDateString()}` : "No expiry" : link.state === "revoked" ? "Revoked" : "Expired"}
            {" · "}{link.view_count} view{link.view_count === 1 ? "" : "s"}
            {link.last_viewed_at ? ` · last opened ${new Date(link.last_viewed_at).toLocaleDateString()}` : ""}
          </small>
        </div>
        {link.state === "active"
          ? <button type="button" className="secondary-button danger-button" disabled={busy} onClick={() => revoke(link)}>Revoke</button>
          : <span className={`status-chip status-${link.state === "revoked" ? "failed" : "queued"}`}>{link.state}</span>}
      </article>) : <p className="font-empty">No share links yet.</p>}
    </div>
    <span className="font-library-status" role="status">{message}</span>
  </dialog>;
}
