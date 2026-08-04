"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ProjectVersion = { id: string; label: string; created_at: string; cue_count: number };

/**
 * Manual snapshot history for one project. Snapshots are taken from what is saved on the server,
 * so this panel saves the editor's pending changes first — otherwise a snapshot could quietly
 * capture the previous state and look like data loss later.
 */
export function VersionHistoryPanel({ videoId, getToken, saveCurrentChanges, onRestored, onClose }: {
  videoId: string;
  getToken: () => Promise<string | undefined>;
  saveCurrentChanges: () => Promise<boolean>;
  onRestored: () => Promise<void>;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Loading history…");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  const authFetch = useCallback(async (path: string, init?: RequestInit) =>
    fetch(path, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${await getToken()}` } }), [getToken]);

  const loadVersions = useCallback(async () => {
    const response = await authFetch(`/api/videos/${videoId}/versions`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(data.error ?? "Could not load version history.");
    setVersions(data.versions ?? []);
    setMessage("");
  }, [authFetch, videoId]);

  useEffect(() => { void loadVersions(); }, [loadVersions]);

  async function createSnapshot() {
    setBusy(true);
    setMessage("Saving current changes…");
    if (!await saveCurrentChanges()) { setMessage("Could not save the current changes, so no snapshot was taken."); return setBusy(false); }
    setMessage("Creating snapshot…");
    const response = await authFetch(`/api/videos/${videoId}/versions`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: label.trim() }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) { setLabel(""); await loadVersions(); setMessage("Snapshot saved."); }
    else setMessage(data.error ?? "Could not save a snapshot.");
    setBusy(false);
  }

  async function restore(version: ProjectVersion) {
    if (!window.confirm(`Restore “${version.label}”? Your current subtitles are snapshotted first, so this can be undone.`)) return;
    setBusy(true);
    setMessage(`Restoring “${version.label}”…`);
    const response = await authFetch(`/api/videos/${videoId}/versions/${version.id}/restore`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      await onRestored();
      await loadVersions();
      setMessage(`Restored ${data.cueCount} cue${data.cueCount === 1 ? "" : "s"} from “${version.label}”.`);
    } else setMessage(data.error ?? "Could not restore that snapshot.");
    setBusy(false);
  }

  async function remove(version: ProjectVersion) {
    if (!window.confirm(`Delete the snapshot “${version.label}”? This cannot be undone.`)) return;
    setBusy(true);
    const response = await authFetch(`/api/videos/${videoId}/versions/${version.id}`, { method: "DELETE" });
    if (response.ok) { await loadVersions(); setMessage("Snapshot deleted."); }
    else setMessage((await response.json().catch(() => ({}))).error ?? "Could not delete that snapshot.");
    setBusy(false);
  }

  return <dialog ref={dialogRef} className="font-library-dialog" aria-labelledby="version-history-title" onCancel={onClose}>
    <div className="font-library-header"><div><span className="section-label">VERSION HISTORY</span><h2 id="version-history-title">Snapshots</h2></div><button type="button" className="dialog-close" aria-label="Close version history" onClick={onClose}>×</button></div>
    <p>Save a snapshot before a risky edit. Restoring one snapshots your current subtitles first, so you can always step back.</p>
    <div className="font-upload-form snapshot-form">
      <label>Snapshot name<input type="text" maxLength={120} value={label} placeholder="Example: before retiming intro" disabled={busy} onChange={(event) => setLabel(event.target.value)} /></label>
      <div className="font-upload-actions"><span>Keeps the 20 most recent snapshots</span><button type="button" className="primary-button small" disabled={busy} onClick={createSnapshot}>Save snapshot</button></div>
    </div>
    <div className="font-library-list">
      {versions.length ? versions.map((version) => <article key={version.id}>
        <div><b>{version.label}</b><small>{new Date(version.created_at).toLocaleString()} · {version.cue_count} cue{version.cue_count === 1 ? "" : "s"}</small></div>
        <div className="snapshot-actions">
          <button type="button" className="secondary-button" disabled={busy} onClick={() => restore(version)}>Restore</button>
          <button type="button" className="secondary-button danger-button" disabled={busy} onClick={() => remove(version)}>Delete</button>
        </div>
      </article>) : <p className="font-empty">No snapshots yet.</p>}
    </div>
    <span className="font-library-status" role="status">{message}</span>
  </dialog>;
}
