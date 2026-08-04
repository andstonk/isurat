"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CaptionOverlay } from "@/components/caption-overlay";
import { loadGoogleFont, loadUploadedFont } from "@/lib/font-loader";
import type { SharedProject } from "@/lib/shared-project";
import { formatTimestamp, translationLanguageLabel, type SubtitleExportMode } from "@/lib/subtitles";

/**
 * Read-only project viewer behind a share link. Intentionally has no save, export, or font-library
 * affordances — a viewer arrives with no session, so every control here is presentational.
 */
export function SharedProjectView({ project }: { project: SharedProject }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackFrameRef = useRef<number | null>(null);
  const [time, setTime] = useState(0);
  const [mode, setMode] = useState<SubtitleExportMode>("original");
  const [fontMessage, setFontMessage] = useState("");
  const hasTranslation = project.translationStatus === "ready" && project.cues.some((cue) => cue.translated_text);
  const targetLanguage = translationLanguageLabel(project.translationTargetLanguage);
  const activeCue = useMemo(() => project.cues.find((cue) => time >= cue.start_ms && time < cue.end_ms), [project.cues, time]);

  useEffect(() => { if (hasTranslation) setMode("bilingual"); }, [hasTranslation]);

  const updatePlaybackTime = useCallback(function updatePlaybackTime() {
    const player = videoRef.current;
    if (!player) return;
    setTime(player.currentTime * 1000);
    if (!player.paused && !player.ended) playbackFrameRef.current = requestAnimationFrame(updatePlaybackTime);
  }, []);
  const stopPlaybackTimer = useCallback(() => {
    if (playbackFrameRef.current != null) cancelAnimationFrame(playbackFrameRef.current);
    playbackFrameRef.current = null;
    if (videoRef.current) setTime(videoRef.current.currentTime * 1000);
  }, []);
  useEffect(() => () => {
    if (playbackFrameRef.current != null) cancelAnimationFrame(playbackFrameRef.current);
  }, []);

  useEffect(() => {
    const styles = [project.settings, project.translationStyle, ...project.cues.flatMap((cue) => cue.style_override ? [cue.style_override] : [])];
    void Promise.all(styles.map(async (style) => {
      if (style.font_source === "google") return loadGoogleFont(style);
      if (style.font_source === "upload" && style.user_font_id) {
        const font = project.customFonts[style.user_font_id];
        if (!font) throw new Error("Uploaded font metadata is unavailable.");
        return loadUploadedFont(font);
      }
    })).then(() => setFontMessage("")).catch(() => setFontMessage("A font used by this project could not be loaded. Showing a fallback font."));
  }, [project.settings, project.translationStyle, project.cues, project.customFonts]);

  return <main className="app-page">
    <header className="app-header">
      <Link href="/" className="brand"><span className="app-logo">S</span><span>subframe</span></Link>
      <nav><span className="share-badge">Read-only</span><Link href="/auth">Sign in</Link></nav>
    </header>
    <div className="editor-page">
      <div className="editor-toolbar">
        <div><span className="section-label">SHARED PROJECT</span><h1>{project.fileName}</h1></div>
        <div className="toolbar-actions">
          <span role="status">{fontMessage}</span>
          {hasTranslation && <label className="track-mode-control">Subtitle track<select value={mode} onChange={(event) => setMode(event.target.value as SubtitleExportMode)}><option value="original">Original only</option><option value="translated">{targetLanguage} only</option><option value="bilingual">Double subtitles</option></select></label>}
        </div>
      </div>
      <div className="editor-workspace">
        <section className="preview-pane">
          <div className="player-wrap">
            <video ref={videoRef} controls preload="metadata" src={project.playbackUrl}
              onPlay={() => { if (playbackFrameRef.current != null) cancelAnimationFrame(playbackFrameRef.current); updatePlaybackTime(); }}
              onPause={stopPlaybackTimer} onEnded={stopPlaybackTimer}
              onSeeked={(event) => setTime(event.currentTarget.currentTime * 1000)}
              onTimeUpdate={(event) => setTime(event.currentTarget.currentTime * 1000)} />
            <CaptionOverlay cue={activeCue} settings={project.settings} translationStyle={project.translationStyle} mode={mode} timeMs={time} />
          </div>
          <p className="preview-help">You are viewing a shared, read-only copy of this subtitle project. Changes made by its owner appear here on reload.{project.expiresAt ? ` This link stops working on ${new Date(project.expiresAt).toLocaleDateString()}.` : ""}</p>
        </section>
        <section className="cue-pane">
          <div className="cue-head"><b>{project.cues.length} subtitle cues</b><span>{hasTranslation ? `${project.language?.toUpperCase() ?? "AUTO"} + ${project.translationTargetLanguage?.toUpperCase()}` : project.language?.toUpperCase() ?? "AUTO"}</span></div>
          {project.cues.map((cue, index) => <article key={index} className={`cue-row shared-cue-row ${activeCue?.cue_index === cue.cue_index ? "active" : ""}`}
            onClick={() => { if (videoRef.current) videoRef.current.currentTime = cue.start_ms / 1000; }}>
            <div className="cue-select"><span className="cue-number">{index + 1}</span></div>
            <div className="time-fields"><small>{formatTimestamp(cue.start_ms, ".")} — {formatTimestamp(cue.end_ms, ".")}</small></div>
            <div className="cue-text-fields">
              <p>{cue.text}</p>
              {cue.translated_text && <p className="shared-translated-text">{cue.translated_text}</p>}
            </div>
          </article>)}
        </section>
      </div>
    </div>
  </main>;
}
