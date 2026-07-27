"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createBrowserSupabase } from "@/lib/supabase";
import { formatTimestamp, type SubtitleCue } from "@/lib/subtitles";

type Video = { id: string; file_name: string; playbackUrl?: string; duration_ms?: number; language?: string };

export function SubtitleEditor({ videoId }: { videoId: string }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [time, setTime] = useState(0);
  const [message, setMessage] = useState("Loading subtitles…");
  const activeCue = useMemo(() => cues.find((cue) => time >= cue.start_ms && time < cue.end_ms), [cues, time]);

  const token = useCallback(async () => (await createBrowserSupabase().auth.getSession()).data.session?.access_token, []);
  const load = useCallback(async () => {
    const accessToken = await token();
    if (!accessToken) return router.push("/auth");
    const response = await fetch(`/api/videos/${videoId}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error);
    setVideo({ ...data.video, playbackUrl: data.playbackUrl }); setCues(data.cues); setMessage("");
  }, [router, token, videoId]);
  useEffect(() => { void load(); }, [load]);

  function update(index: number, patch: Partial<SubtitleCue>) { setCues((current) => current.map((cue, cueIndex) => cueIndex === index ? { ...cue, ...patch } : cue)); }
  async function save() {
    setMessage("Saving…"); const accessToken = await token();
    const response = await fetch(`/api/videos/${videoId}/subtitles`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ cues }) });
    const data = await response.json(); setMessage(response.ok ? "All changes saved." : data.error);
  }
  async function download(format: string) {
    const accessToken = await token();
    const response = await fetch(`/api/videos/${videoId}/export?format=${format}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) return setMessage((await response.json()).error);
    const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `${video?.file_name.replace(/\.mp4$/i, "")}.${format}`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <AppShell><div className="editor-page"><div className="editor-toolbar"><div><span className="section-label">SUBTITLE EDITOR</span><h1>{video?.file_name ?? "Project"}</h1></div><div className="toolbar-actions"><span>{message}</span><button className="secondary-button" onClick={save}>Save changes</button>{["srt", "vtt", "txt"].map((format) => <button key={format} className="primary-button small" onClick={() => download(format)}>↓ {format.toUpperCase()}</button>)}</div></div>
    <div className="editor-workspace"><section className="preview-pane"><div className="player-wrap">{video?.playbackUrl ? <video ref={videoRef} controls preload="metadata" src={video.playbackUrl} onPlay={(event) => { event.currentTarget.defaultMuted = false; event.currentTarget.muted = false; if (event.currentTarget.volume === 0) event.currentTarget.volume = 1; }} onTimeUpdate={(event) => setTime(event.currentTarget.currentTime * 1000)} /> : <div className="player-placeholder">Video preview</div>}{activeCue && <div className="live-caption">{activeCue.text}</div>}</div><p className="preview-help">Play the video to preview your edited subtitles in context.</p></section>
    <section className="cue-pane"><div className="cue-head"><b>{cues.length} subtitle cues</b><span>{video?.language?.toUpperCase() ?? "AUTO"}</span></div>{cues.map((cue, index) => <article className={`cue-row ${activeCue?.cue_index === cue.cue_index ? "active" : ""}`} key={cue.id ?? index} onClick={() => { if (videoRef.current) videoRef.current.currentTime = cue.start_ms / 1000; }}><span className="cue-number">{index + 1}</span><div className="time-fields"><input aria-label="Start time in milliseconds" type="number" min="0" value={cue.start_ms} onChange={(e) => update(index, { start_ms: Number(e.target.value) })} /><span>→</span><input aria-label="End time in milliseconds" type="number" min="1" value={cue.end_ms} onChange={(e) => update(index, { end_ms: Number(e.target.value) })} /><small>{formatTimestamp(cue.start_ms, ".")} — {formatTimestamp(cue.end_ms, ".")}</small></div><textarea aria-label={`Subtitle ${index + 1}`} value={cue.text} onChange={(e) => update(index, { text: e.target.value })} /></article>)}</section></div></div></AppShell>;
}