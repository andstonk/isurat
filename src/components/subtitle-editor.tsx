"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createBrowserSupabase } from "@/lib/supabase";
import {
  DEFAULT_SUBTITLE_SETTINGS,
  formatTimestamp,
  isSubtitleFont,
  resegmentCues,
  SUBTITLE_FONTS,
  translationLanguageLabel,
  type SubtitleCue,
  type SubtitleExportMode,
  type SubtitleSettings,
} from "@/lib/subtitles";

type Video = {
  id: string;
  file_name: string;
  playbackUrl?: string;
  duration_ms?: number;
  language?: string;
  translation_target_language?: string | null;
  translation_status?: string;
  subtitle_font_family?: string;
  subtitle_text_color?: string;
  subtitle_font_size?: number;
  subtitle_bold?: boolean;
  subtitle_italic?: boolean;
  subtitle_underline?: boolean;
  subtitle_strikethrough?: boolean;
  subtitle_backdrop_color?: string;
  subtitle_backdrop_opacity?: number;
  words_per_cue?: number;
};

export function SubtitleEditor({ videoId }: { videoId: string }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [settings, setSettings] = useState<SubtitleSettings>(DEFAULT_SUBTITLE_SETTINGS);
  const [subtitleMode, setSubtitleMode] = useState<SubtitleExportMode>("original");
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
    const loadedVideo = data.video as Video;
    setVideo({ ...loadedVideo, playbackUrl: data.playbackUrl });
    setCues(data.cues);
    if (loadedVideo.translation_status === "ready") setSubtitleMode("bilingual");
    setSettings({
      font_family: isSubtitleFont(loadedVideo.subtitle_font_family) ? loadedVideo.subtitle_font_family : DEFAULT_SUBTITLE_SETTINGS.font_family,
      text_color: /^#[0-9a-f]{6}$/i.test(loadedVideo.subtitle_text_color ?? "") ? loadedVideo.subtitle_text_color! : DEFAULT_SUBTITLE_SETTINGS.text_color,
      font_size: loadedVideo.subtitle_font_size && loadedVideo.subtitle_font_size >= 12 && loadedVideo.subtitle_font_size <= 64 ? loadedVideo.subtitle_font_size : DEFAULT_SUBTITLE_SETTINGS.font_size,
      bold: loadedVideo.subtitle_bold ?? DEFAULT_SUBTITLE_SETTINGS.bold,
      italic: loadedVideo.subtitle_italic ?? DEFAULT_SUBTITLE_SETTINGS.italic,
      underline: loadedVideo.subtitle_underline ?? DEFAULT_SUBTITLE_SETTINGS.underline,
      strikethrough: loadedVideo.subtitle_strikethrough ?? DEFAULT_SUBTITLE_SETTINGS.strikethrough,
      backdrop_color: /^#[0-9a-f]{6}$/i.test(loadedVideo.subtitle_backdrop_color ?? "") ? loadedVideo.subtitle_backdrop_color! : DEFAULT_SUBTITLE_SETTINGS.backdrop_color,
      backdrop_opacity: loadedVideo.subtitle_backdrop_opacity ?? DEFAULT_SUBTITLE_SETTINGS.backdrop_opacity,
      words_per_cue: loadedVideo.words_per_cue ?? DEFAULT_SUBTITLE_SETTINGS.words_per_cue,
    });
    setMessage("");
  }, [router, token, videoId]);
  useEffect(() => { void load(); }, [load]);

  function update(index: number, patch: Partial<SubtitleCue>) { setCues((current) => current.map((cue, cueIndex) => cueIndex === index ? { ...cue, ...patch } : cue)); }
  async function save() {
    setMessage("Saving…"); const accessToken = await token();
    const response = await fetch(`/api/videos/${videoId}/subtitles`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ cues, settings }) });
    const data = await response.json(); setMessage(response.ok ? "All changes saved." : data.error);
  }
  function applyWordLimit() {
    setCues((current) => resegmentCues(current, settings.words_per_cue));
    setMessage(`Subtitles regrouped to ${settings.words_per_cue} words maximum. Save to keep changes.`);
  }
  async function download(format: string) {
    const accessToken = await token();
    const response = await fetch(`/api/videos/${videoId}/export?format=${format}&mode=${subtitleMode}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) return setMessage((await response.json()).error);
    const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `${video?.file_name.replace(/\.mp4$/i, "")}.${format}`; anchor.click(); URL.revokeObjectURL(url);
  }

  const captionBackground = `${settings.backdrop_color}${Math.round(settings.backdrop_opacity * 2.55).toString(16).padStart(2, "0")}`;
  const textDecoration = [settings.underline && "underline", settings.strikethrough && "line-through"].filter(Boolean).join(" ") || "none";
  const hasTranslation = video?.translation_status === "ready" && cues.some((cue) => cue.translated_text);
  const targetLanguage = translationLanguageLabel(video?.translation_target_language);

  return <AppShell><div className="editor-page"><div className="editor-toolbar"><div><span className="section-label">SUBTITLE EDITOR</span><h1>{video?.file_name ?? "Project"}</h1></div><div className="toolbar-actions"><span role="status">{message}</span>{hasTranslation && <label className="track-mode-control">Subtitle track<select value={subtitleMode} onChange={(event) => setSubtitleMode(event.target.value as SubtitleExportMode)}><option value="original">Original only</option><option value="translated">{targetLanguage} only</option><option value="bilingual">Double subtitles</option></select></label>}<button className="secondary-button" onClick={save}>Save changes</button>{["srt", "vtt", "txt"].map((format) => <button key={format} className="primary-button small" onClick={() => download(format)}>↓ {format.toUpperCase()}</button>)}</div></div>
    <div className="editor-workspace"><section className="preview-pane"><div className="player-wrap">{video?.playbackUrl ? <video ref={videoRef} controls preload="metadata" src={video.playbackUrl} onPlay={(event) => { event.currentTarget.defaultMuted = false; event.currentTarget.muted = false; if (event.currentTarget.volume === 0) event.currentTarget.volume = 1; }} onTimeUpdate={(event) => setTime(event.currentTarget.currentTime * 1000)} /> : <div className="player-placeholder">Video preview</div>}{activeCue && <div className="live-caption" style={{ fontFamily: `"${settings.font_family}", sans-serif`, fontSize: `${settings.font_size}px`, fontWeight: settings.bold ? 700 : 400, fontStyle: settings.italic ? "italic" : "normal", textDecoration, color: settings.text_color, backgroundColor: captionBackground }}>{subtitleMode !== "translated" && <span>{activeCue.text}</span>}{subtitleMode === "bilingual" && activeCue.translated_text && <span className="translated-caption">{activeCue.translated_text}</span>}{subtitleMode === "translated" && <span>{activeCue.translated_text ?? activeCue.text}</span>}</div>}</div><p className="preview-help">{hasTranslation ? `Showing ${subtitleMode === "bilingual" ? "original and translated" : subtitleMode} subtitles. Downloads use this selection.` : "Play the video to preview your edited subtitles in context."}</p>
      <div className="subtitle-controls"><div className="controls-heading"><div><span className="section-label">APPEARANCE</span><h2>Subtitle style</h2></div><small>Preview updates instantly</small></div><div className="control-grid">
        <label>Font<select value={settings.font_family} onChange={(event) => setSettings((current) => ({ ...current, font_family: event.target.value as SubtitleSettings["font_family"] }))}>{SUBTITLE_FONTS.map((font) => <option key={font} value={font} style={{ fontFamily: font }}>{font}</option>)}</select></label>
        <label>Text color<span className="color-control"><input aria-label="Subtitle text color" type="color" value={settings.text_color} onChange={(event) => setSettings((current) => ({ ...current, text_color: event.target.value }))} /><output>{settings.text_color.toUpperCase()}</output></span></label>
        <label className="range-control">Font size <output>{settings.font_size}px</output><input type="range" min="12" max="64" step="1" value={settings.font_size} onChange={(event) => setSettings((current) => ({ ...current, font_size: Number(event.target.value) }))} /></label>
        <div className="control-field formatting-control"><span>Text formatting</span><div className="format-buttons"><button type="button" aria-label="Bold" aria-pressed={settings.bold} className={settings.bold ? "active" : ""} onClick={() => setSettings((current) => ({ ...current, bold: !current.bold }))}><b>B</b></button><button type="button" aria-label="Italic" aria-pressed={settings.italic} className={settings.italic ? "active" : ""} onClick={() => setSettings((current) => ({ ...current, italic: !current.italic }))}><i>I</i></button><button type="button" aria-label="Underline" aria-pressed={settings.underline} className={settings.underline ? "active" : ""} onClick={() => setSettings((current) => ({ ...current, underline: !current.underline }))}><u>U</u></button><button type="button" aria-label="Strikethrough" aria-pressed={settings.strikethrough} className={settings.strikethrough ? "active" : ""} onClick={() => setSettings((current) => ({ ...current, strikethrough: !current.strikethrough }))}><s>S</s></button></div></div>
        <label>Backdrop color<span className="color-control"><input type="color" value={settings.backdrop_color} onChange={(event) => setSettings((current) => ({ ...current, backdrop_color: event.target.value }))} /><output>{settings.backdrop_color.toUpperCase()}</output></span></label>
        <label className="range-control">Backdrop opacity <output>{settings.backdrop_opacity}%</output><input type="range" min="0" max="100" step="1" value={settings.backdrop_opacity} onChange={(event) => setSettings((current) => ({ ...current, backdrop_opacity: Number(event.target.value) }))} /></label>
        <div className="control-field range-control words-control"><label htmlFor="words-per-cue">Maximum words per subtitle</label><output htmlFor="words-per-cue">{settings.words_per_cue} words</output><input id="words-per-cue" type="range" min="2" max="16" step="1" value={settings.words_per_cue} onChange={(event) => setSettings((current) => ({ ...current, words_per_cue: Number(event.target.value) }))} /><span className="range-scale"><small>2</small><small>16</small></span><button type="button" className="secondary-button apply-limit" onClick={applyWordLimit}>Apply word limit</button></div>
      </div></div></section>
    <section className="cue-pane"><div className="cue-head"><b>{cues.length} subtitle cues</b><span>{hasTranslation ? `${video?.language?.toUpperCase() ?? "AUTO"} + ${video?.translation_target_language?.toUpperCase()}` : video?.language?.toUpperCase() ?? "AUTO"}</span></div>{cues.map((cue, index) => <article className={`cue-row ${activeCue?.cue_index === cue.cue_index ? "active" : ""}`} key={cue.id ?? index} onClick={() => { if (videoRef.current) videoRef.current.currentTime = cue.start_ms / 1000; }}><span className="cue-number">{index + 1}</span><div className="time-fields"><input aria-label="Start time in milliseconds" type="number" min="0" value={cue.start_ms} onChange={(e) => update(index, { start_ms: Number(e.target.value) })} /><span>→</span><input aria-label="End time in milliseconds" type="number" min="1" value={cue.end_ms} onChange={(e) => update(index, { end_ms: Number(e.target.value) })} /><small>{formatTimestamp(cue.start_ms, ".")} — {formatTimestamp(cue.end_ms, ".")}</small></div><div className="cue-text-fields"><label><small>Original</small><textarea aria-label={`Original subtitle ${index + 1}`} value={cue.text} onChange={(e) => update(index, { text: e.target.value })} /></label>{cue.translated_text != null && <label><small>{targetLanguage}</small><textarea aria-label={`${targetLanguage} subtitle ${index + 1}`} value={cue.translated_text} onChange={(e) => update(index, { translated_text: e.target.value })} /></label>}</div></article>)}</section></div></div></AppShell>;
}