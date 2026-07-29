"use client";

import { useEffect, useRef, useState } from "react";
import type { UserFont } from "@/lib/fonts";

export function FontLibraryPanel({ fonts, quota, getToken, onClose, onChanged }: {
  fonts: UserFont[];
  quota: { used: number; limit: number };
  getToken: () => Promise<string | undefined>;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return setMessage("Select a font file.");
    setBusy(true);
    setMessage("Uploading font…");
    const body = new FormData();
    body.set("file", file);
    body.set("displayName", displayName);
    body.set("rightsConfirmed", String(rightsConfirmed));
    const response = await fetch("/api/fonts", { method: "POST", headers: { Authorization: `Bearer ${await getToken()}` }, body });
    const data = response.status === 204 ? {} : await response.json();
    if (response.ok) {
      setFile(null);
      setDisplayName("");
      setRightsConfirmed(false);
      setMessage("Font uploaded.");
      await onChanged();
    } else setMessage(data.error ?? "Could not upload the font.");
    setBusy(false);
  }

  async function archive(font: UserFont) {
    if (!window.confirm(`Archive “${font.displayName}”? Existing projects can keep using it.`)) return;
    setBusy(true);
    const response = await fetch(`/api/fonts/${font.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${await getToken()}` } });
    if (response.ok) {
      setMessage("Font archived.");
      await onChanged();
    } else setMessage((await response.json()).error ?? "Could not archive the font.");
    setBusy(false);
  }

  return <dialog ref={dialogRef} className="font-library-dialog" aria-labelledby="font-library-title" onCancel={onClose}>
    <div className="font-library-header"><div><span className="section-label">MY FONTS</span><h2 id="font-library-title">Custom font library</h2></div><button type="button" className="dialog-close" aria-label="Close font library" onClick={onClose}>×</button></div>
    <p>Upload private fonts for subtitle previews. WOFF2, WOFF, TTF, and OTF files up to 5 MB are supported.</p>
    <form className="font-upload-form" onSubmit={upload}>
      <label className="font-drop-zone">Font file<input type="file" accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf" disabled={busy} onChange={(event) => { const selected = event.target.files?.[0] ?? null; setFile(selected); if (selected && !displayName) setDisplayName(selected.name.replace(/\.[^.]+$/, "")); }} /><span>{file?.name ?? "Choose or drop a font file"}</span></label>
      <label>Display name<input type="text" maxLength={100} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Example: Brand Sans" /></label>
      <label className="rights-confirmation"><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} /><span>I confirm that I have the right or license to use and upload this font.</span></label>
      <div className="font-upload-actions"><span>{quota.used} of {quota.limit} fonts used</span><button type="submit" className="primary-button small" disabled={busy || !file || !rightsConfirmed}>Upload font</button></div>
    </form>
    <div className="font-library-list">
      {fonts.length ? fonts.map((font) => <article key={font.id}><div><b>{font.displayName}</b><small>{font.originalFileName} · {(font.fileSize / 1024).toFixed(0)} KB · {font.format.toUpperCase()}</small></div><button type="button" className="secondary-button danger-button" disabled={busy} onClick={() => archive(font)}>Archive</button></article>) : <p className="font-empty">No custom fonts uploaded yet.</p>}
    </div>
    <span className="font-library-status" role="status">{message}</span>
  </dialog>;
}
