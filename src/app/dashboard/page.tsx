"use client";

import Link from "next/link";
import { ChangeEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createBrowserSupabase } from "@/lib/supabase";

type Video = { id: string; file_name: string; file_size: number; status: string; error_message?: string; language?: string; created_at: string };

async function authFetch(path: string, init?: RequestInit) {
  const { data } = await createBrowserSupabase().auth.getSession();
  if (!data.session) throw new Error("AUTH_REQUIRED");
  return fetch(path, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${data.session.access_token}` } });
}

export default function DashboardPage() {
  const router = useRouter();
  const [videos, setVideos] = useState<Video[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const loadVideos = useCallback(async () => {
    try {
      const response = await authFetch("/api/videos");
      if (response.status === 401) return router.push("/auth");
      const data = await response.json();
      setVideos(data.videos ?? []);
    } catch (error) { if (error instanceof Error && error.message === "AUTH_REQUIRED") router.push("/auth"); }
  }, [router]);

  useEffect(() => { void loadVideos(); }, [loadVideos]);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setStatus("Preparing secure upload…");
    try {
      const init = await authFetch("/api/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, fileSize: file.size, contentType: file.type }) });
      const job = await init.json();
      if (!init.ok) throw new Error(job.error);
      setStatus("Uploading MP4 to Azure Blob Storage…");
      const uploaded = await fetch(job.uploadUrl, { method: "PUT", headers: { "x-ms-blob-type": "BlockBlob", "Content-Type": "video/mp4" }, body: file });
      if (!uploaded.ok) throw new Error("Azure upload failed. Check storage CORS settings.");
      setStatus("Creating processing job…");
      const complete = await authFetch("/api/uploads/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ videoId: job.videoId }) });
      if (!complete.ok) throw new Error((await complete.json()).error);
      setStatus("Transcribing and timestamping with Soniox…");
      const processed = await authFetch("/api/jobs/process", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ videoId: job.videoId }) });
      const result = await processed.json();
      if (!processed.ok) throw new Error(result.error);
      setStatus("Subtitles are ready.");
      await loadVideos();
      router.push(`/editor/${job.videoId}`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Upload failed."); await loadVideos(); }
    finally { setBusy(false); event.target.value = ""; }
  }

  return (
    <AppShell>
      <div className="app-container">
        <div className="app-title"><div><span className="section-label">YOUR WORKSPACE</span><h1>Subtitle projects</h1><p>Upload an MP4, transcribe it, refine the timing, and export.</p></div>
          <label className={`primary-button upload-label ${busy ? "disabled" : ""}`}>+ New video<input type="file" accept="video/mp4,.mp4" onChange={upload} disabled={busy} /></label>
        </div>
        {status && <div className="status-banner" role="status"><span className={busy ? "status-pulse" : ""} />{status}</div>}
        <section className="project-list">
          {videos.length === 0 ? <div className="empty-state"><b>No subtitle projects yet</b><p>Upload an MP4 up to 25 MB to create the first one.</p></div> : videos.map((video) => (
            <article key={video.id} className="project-row">
              <div className="video-thumb">MP4</div><div className="project-meta"><h2>{video.file_name}</h2><p>{(video.file_size / 1024 / 1024).toFixed(1)} MB · {new Date(video.created_at).toLocaleDateString()}</p>{video.error_message && <small>{video.error_message}</small>}</div>
              <span className={`status-chip status-${video.status}`}>{video.status}</span>
              {video.status === "ready" && <Link className="secondary-button" href={`/editor/${video.id}`}>Open editor</Link>}
            </article>
          ))}
        </section>
      </div>
    </AppShell>
  );
}