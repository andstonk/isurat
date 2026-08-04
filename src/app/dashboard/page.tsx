"use client";

import Link from "next/link";
import { ChangeEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createBrowserSupabase } from "@/lib/supabase";
import { TRANSLATION_LANGUAGES, type TranslationLanguage } from "@/lib/subtitles";
import { DEFAULT_MAX_UPLOAD_BYTES, formatUploadLimit } from "@/lib/upload-limits";

type Video = { id: string; file_name: string; file_size: number; status: string; error_message?: string; language?: string; created_at: string; updated_at: string };

const STUCK_PROCESSING_MS = 6 * 60 * 1000;
function isStuckProcessing(video: Video) {
  return video.status === "processing" && Date.now() - new Date(video.updated_at).getTime() > STUCK_PROCESSING_MS;
}

async function authFetch(path: string, init?: RequestInit) {
  const { data } = await createBrowserSupabase().auth.getSession();
  if (!data.session) throw new Error("AUTH_REQUIRED");
  return fetch(path, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${data.session.access_token}` } });
}

export default function DashboardPage() {
  const router = useRouter();
  const [videos, setVideos] = useState<Video[]>([]);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [targetLanguage, setTargetLanguage] = useState<TranslationLanguage | "">("");
  // Server-resolved: allowlisted accounts get a larger ceiling than the 25 MB default.
  const [maxUploadBytes, setMaxUploadBytes] = useState(DEFAULT_MAX_UPLOAD_BYTES);

  const loadVideos = useCallback(async () => {
    try {
      const response = await authFetch("/api/videos");
      if (response.status === 401) return router.push("/auth");
      const data = await response.json();
      setVideos(data.videos ?? []);
      if (data.maxUploadBytes) setMaxUploadBytes(data.maxUploadBytes);
    } catch (error) { if (error instanceof Error && error.message === "AUTH_REQUIRED") router.push("/auth"); }
  }, [router]);

  useEffect(() => { void loadVideos(); }, [loadVideos]);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setStatus("Preparing secure upload…");
    try {
      const init = await authFetch("/api/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, fileSize: file.size, contentType: file.type, targetLanguage: targetLanguage || null }) });
      const job = await init.json();
      if (!init.ok) throw new Error(job.error);
      setStatus("Uploading video to Azure Blob Storage…");
      const uploaded = await fetch(job.uploadUrl, { method: "PUT", headers: { "x-ms-blob-type": "BlockBlob", "Content-Type": file.type || "application/octet-stream" }, body: file });
      if (!uploaded.ok) throw new Error("Azure upload failed. Check storage CORS settings.");
      setStatus("Creating processing job…");
      const complete = await authFetch("/api/uploads/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ videoId: job.videoId }) });
      if (!complete.ok) throw new Error((await complete.json()).error);
      setStatus(targetLanguage ? "Converting video and transcribing/translating with Soniox…" : "Converting video and transcribing with Soniox…");
      const processed = await authFetch("/api/jobs/process", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ videoId: job.videoId }) });
      const result = await processed.json();
      if (!processed.ok) throw new Error(result.error);
      setStatus("Subtitles are ready.");
      await loadVideos();
      router.push(`/editor/${job.videoId}`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Upload failed."); await loadVideos(); }
    finally { setBusy(false); event.target.value = ""; }
  }

  async function deleteVideo(video: Video) {
    if (!window.confirm(`Delete “${video.file_name}” and all of its subtitles? This cannot be undone.`)) return;
    setDeletingId(video.id);
    setStatus(`Deleting ${video.file_name}…`);
    try {
      const response = await authFetch(`/api/videos/${video.id}`, { method: "DELETE" });
      if (response.status === 401) return router.push("/auth");
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error ?? "Could not delete the video project.");
      }
      setVideos((current) => current.filter((item) => item.id !== video.id));
      setStatus(`${video.file_name} was deleted.`);
    } catch (error) {
      setStatus(error instanceof Error && error.message !== "AUTH_REQUIRED" ? error.message : "Could not delete the video project.");
      if (error instanceof Error && error.message === "AUTH_REQUIRED") router.push("/auth");
    } finally {
      setDeletingId(null);
    }
  }

  async function retryVideo(video: Video) {
    setRetryingId(video.id);
    setStatus(`Retrying ${video.file_name}…`);
    try {
      const response = await authFetch("/api/jobs/process", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ videoId: video.id }) });
      if (response.status === 401) return router.push("/auth");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not retry this video.");
      setStatus(`${video.file_name} is processing again.`);
    } catch (error) {
      setStatus(error instanceof Error && error.message !== "AUTH_REQUIRED" ? error.message : "Could not retry this video.");
      if (error instanceof Error && error.message === "AUTH_REQUIRED") router.push("/auth");
    } finally {
      setRetryingId(null);
      await loadVideos();
    }
  }

  return (
    <AppShell>
      <div className="app-container">
        <div className="app-title"><div><span className="section-label">YOUR WORKSPACE</span><h1>Subtitle projects</h1><p>Upload an MP4 or MOV (including HEVC from phones), transcribe it, refine the timing, and export.</p></div>
          <div className="new-project-controls"><label>Translate subtitles to<select value={targetLanguage} disabled={busy} onChange={(event) => setTargetLanguage(event.target.value as TranslationLanguage | "")}><option value="">No translation</option>{TRANSLATION_LANGUAGES.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}</select></label><label className={`primary-button upload-label ${busy ? "disabled" : ""}`}>+ New video<input type="file" accept="video/mp4,.mp4,video/quicktime,.mov,.m4v" onChange={upload} disabled={busy} /></label></div>
        </div>
        {status && <div className="status-banner" role="status"><span className={busy ? "status-pulse" : ""} />{status}</div>}
        <section className="project-list">
          {videos.length === 0 ? <div className="empty-state"><b>No subtitle projects yet</b><p>Upload an MP4 up to {formatUploadLimit(maxUploadBytes)} to create the first one.</p></div> : videos.map((video) => (
            <article key={video.id} className="project-row">
              <div className="video-thumb">MP4</div><div className="project-meta"><h2>{video.file_name}</h2><p>{(video.file_size / 1024 / 1024).toFixed(1)} MB · {new Date(video.created_at).toLocaleDateString()}</p>{video.error_message && <small>{video.error_message}</small>}</div>
              <span className={`status-chip status-${video.status}`}>{video.status}</span>
              <div className="project-actions">
                {video.status === "ready" && <Link className="secondary-button" href={`/editor/${video.id}`}>Open editor</Link>}
                {(video.status === "failed" || isStuckProcessing(video)) && (
                  <button className="secondary-button" type="button" onClick={() => void retryVideo(video)} disabled={retryingId !== null}>
                    {retryingId === video.id ? "Retrying…" : isStuckProcessing(video) ? "Retry (stuck)" : "Retry"}
                  </button>
                )}
                <button className="secondary-button danger-button" type="button" onClick={() => void deleteVideo(video)} disabled={deletingId !== null}>
                  {deletingId === video.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </article>
          ))}
        </section>
      </div>
    </AppShell>
  );
}