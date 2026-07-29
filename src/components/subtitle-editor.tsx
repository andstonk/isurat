"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FontLibraryPanel } from "@/components/font-library-panel";
import { FontPicker } from "@/components/font-picker";
import { loadGoogleFont, loadUploadedFont, resolvedFontFamily } from "@/lib/font-loader";
import { isFontSource, type GoogleFont, type UserFont } from "@/lib/fonts";
import { createBrowserSupabase } from "@/lib/supabase";
import {
  DEFAULT_SUBTITLE_SETTINGS,
  DEFAULT_TRANSLATION_STYLE,
  formatTimestamp,
  isSubtitleFont,
  resegmentCues,
  timedWordsForCue,
  translationLanguageLabel,
  type SubtitleCue,
  type SubtitleExportMode,
  type SubtitleSettings,
  type SubtitleTrackStyle,
  type SubtitleWordStyle,
} from "@/lib/subtitles";

function TrackStyleControls({ style, name, googleFonts, userFonts, googleUnavailable, onChange, onManageFonts }: {
  style: SubtitleTrackStyle;
  name: string;
  googleFonts: GoogleFont[];
  userFonts: UserFont[];
  googleUnavailable: boolean;
  onChange: (style: SubtitleTrackStyle) => void;
  onManageFonts: () => void;
}) {
  const patch = (value: Partial<SubtitleTrackStyle>) => onChange({ ...style, ...value });
  return <div className="control-grid track-style-grid">
    <FontPicker name={name} style={style} googleFonts={googleFonts} userFonts={userFonts} googleUnavailable={googleUnavailable} onChange={patch} onManageFonts={onManageFonts} />
    <label>Text color<span className="color-control"><input aria-label={`${name} subtitle text color`} type="color" value={style.text_color} onChange={(event) => patch({ text_color: event.target.value })} /><output>{style.text_color.toUpperCase()}</output></span></label>
    <label className="range-control">Font size <output>{style.font_size}px</output><input aria-label={`${name} subtitle font size`} type="range" min="12" max="64" step="1" value={style.font_size} onChange={(event) => patch({ font_size: Number(event.target.value) })} /></label>
    <div className="control-field formatting-control"><span>Text formatting</span><div className="format-buttons"><button type="button" aria-label={`${name} bold`} aria-pressed={style.bold} className={style.bold ? "active" : ""} onClick={() => patch({ bold: !style.bold })}><b>B</b></button><button type="button" aria-label={`${name} italic`} aria-pressed={style.italic} className={style.italic ? "active" : ""} onClick={() => patch({ italic: !style.italic })}><i>I</i></button><button type="button" aria-label={`${name} underline`} aria-pressed={style.underline} className={style.underline ? "active" : ""} onClick={() => patch({ underline: !style.underline })}><u>U</u></button><button type="button" aria-label={`${name} strikethrough`} aria-pressed={style.strikethrough} className={style.strikethrough ? "active" : ""} onClick={() => patch({ strikethrough: !style.strikethrough })}><s>S</s></button></div></div>
    <label>Backdrop color<span className="color-control"><input aria-label={`${name} subtitle backdrop color`} type="color" value={style.backdrop_color} onChange={(event) => patch({ backdrop_color: event.target.value })} /><output>{style.backdrop_color.toUpperCase()}</output></span></label>
    <label className="range-control">Backdrop opacity <output>{style.backdrop_opacity}%</output><input aria-label={`${name} subtitle backdrop opacity`} type="range" min="0" max="100" step="1" value={style.backdrop_opacity} onChange={(event) => patch({ backdrop_opacity: Number(event.target.value) })} /></label>
    <label className="effect-toggle"><span>Glow effect</span><input type="checkbox" checked={style.glow_enabled} onChange={(event) => patch({ glow_enabled: event.target.checked })} /></label>
    <label>Glow color<span className="color-control"><input aria-label={`${name} subtitle glow color`} type="color" value={style.glow_color} disabled={!style.glow_enabled} onChange={(event) => patch({ glow_color: event.target.value })} /><output>{style.glow_color.toUpperCase()}</output></span></label>
    <label className="range-control">Glow blur <output>{style.glow_blur}px</output><input aria-label={`${name} subtitle glow blur`} type="range" min="0" max="40" step="1" value={style.glow_blur} disabled={!style.glow_enabled} onChange={(event) => patch({ glow_blur: Number(event.target.value) })} /></label>
    <label className="range-control">Glow intensity <output>{style.glow_intensity}%</output><input aria-label={`${name} subtitle glow intensity`} type="range" min="0" max="100" step="1" value={style.glow_intensity} disabled={!style.glow_enabled} onChange={(event) => patch({ glow_intensity: Number(event.target.value) })} /></label>
  </div>;
}

function captionStyle(style: SubtitleTrackStyle) {
  const backdropAlpha = Math.round(style.backdrop_opacity * 2.55).toString(16).padStart(2, "0");
  const glowAlpha = Math.round(style.glow_intensity * 2.55).toString(16).padStart(2, "0");
  return {
    fontFamily: resolvedFontFamily(style),
    fontSize: `${style.font_size}px`,
    fontWeight: style.bold ? 700 : 400,
    fontStyle: style.italic ? "italic" : "normal",
    textDecoration: [style.underline && "underline", style.strikethrough && "line-through"].filter(Boolean).join(" ") || "none",
    color: style.text_color,
    backgroundColor: `${style.backdrop_color}${backdropAlpha}`,
    textShadow: style.glow_enabled ? `0 0 ${style.glow_blur}px ${style.glow_color}${glowAlpha}` : "none",
  } as const;
}

function wordStyle(style?: SubtitleWordStyle, karaokeColor?: string) {
  return {
    fontWeight: style?.bold === undefined ? undefined : style.bold ? 700 : 400,
    fontStyle: style?.italic === undefined ? undefined : style.italic ? "italic" : "normal",
    textDecoration: style?.underline === undefined ? undefined : style.underline ? "underline" : "none",
    color: karaokeColor ?? style?.text_color,
  } as const;
}

type Video = {
  id: string;
  file_name: string;
  playbackUrl?: string;
  duration_ms?: number;
  language?: string;
  translation_target_language?: string | null;
  translation_status?: string;
  subtitle_font_family?: string;
  subtitle_font_source?: string;
  subtitle_user_font_id?: string | null;
  subtitle_text_color?: string;
  subtitle_font_size?: number;
  subtitle_bold?: boolean;
  subtitle_italic?: boolean;
  subtitle_underline?: boolean;
  subtitle_strikethrough?: boolean;
  subtitle_backdrop_color?: string;
  subtitle_backdrop_opacity?: number;
  subtitle_glow_enabled?: boolean;
  subtitle_glow_color?: string;
  subtitle_glow_blur?: number;
  subtitle_glow_intensity?: number;
  translation_font_family?: string;
  translation_font_source?: string;
  translation_user_font_id?: string | null;
  translation_text_color?: string;
  translation_font_size?: number;
  translation_bold?: boolean;
  translation_italic?: boolean;
  translation_underline?: boolean;
  translation_strikethrough?: boolean;
  translation_backdrop_color?: string;
  translation_backdrop_opacity?: number;
  translation_glow_enabled?: boolean;
  translation_glow_color?: string;
  translation_glow_blur?: number;
  translation_glow_intensity?: number;
  words_per_cue?: number;
  karaoke_enabled?: boolean;
  karaoke_color?: string;
};

export function SubtitleEditor({ videoId }: { videoId: string }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackFrameRef = useRef<number | null>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [settings, setSettings] = useState<SubtitleSettings>(DEFAULT_SUBTITLE_SETTINGS);
  const [translationStyle, setTranslationStyle] = useState<SubtitleTrackStyle>(DEFAULT_TRANSLATION_STYLE);
  const [userFonts, setUserFonts] = useState<UserFont[]>([]);
  const [googleFonts, setGoogleFonts] = useState<GoogleFont[]>([]);
  const [fontQuota, setFontQuota] = useState({ used: 0, limit: 50 });
  const [googleUnavailable, setGoogleUnavailable] = useState(false);
  const [fontLibraryOpen, setFontLibraryOpen] = useState(false);
  const [expandedCue, setExpandedCue] = useState<number | null>(null);
  const [selectedWord, setSelectedWord] = useState<{ cueIndex: number; wordIndex: number } | null>(null);
  const [fontMessage, setFontMessage] = useState("");
  const [subtitleMode, setSubtitleMode] = useState<SubtitleExportMode>("original");
  const [time, setTime] = useState(0);
  const [message, setMessage] = useState("Loading subtitles…");
  const activeCue = useMemo(() => cues.find((cue) => time >= cue.start_ms && time < cue.end_ms), [cues, time]);
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

  const token = useCallback(async () => (await createBrowserSupabase().auth.getSession()).data.session?.access_token, []);
  const loadFontLibrary = useCallback(async () => {
    const accessToken = await token();
    if (!accessToken) return;
    const response = await fetch("/api/fonts", { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) return setFontMessage((await response.json()).error ?? "Could not load your fonts.");
    const data = await response.json();
    setUserFonts((current) => [...(data.fonts ?? []), ...current.filter((font) => font.archivedAt && !(data.fonts ?? []).some((active: UserFont) => active.id === font.id))]);
    setFontQuota(data.quota ?? { used: 0, limit: 50 });
  }, [token]);
  const load = useCallback(async () => {
    const accessToken = await token();
    if (!accessToken) return router.push("/auth");
    const headers = { Authorization: `Bearer ${accessToken}` };
    const [response, fontResponse, googleResponse] = await Promise.all([
      fetch(`/api/videos/${videoId}`, { headers }),
      fetch("/api/fonts", { headers }),
      fetch("/api/fonts/google", { headers }),
    ]);
    const data = await response.json();
    if (!response.ok) return setMessage(data.error);
    if (fontResponse.ok) {
      const fontData = await fontResponse.json();
      const referencedFonts = Object.values(data.customFonts ?? {}) as UserFont[];
      const activeFonts = fontData.fonts as UserFont[];
      setUserFonts([...activeFonts, ...referencedFonts.filter((font) => !activeFonts.some((active) => active.id === font.id))]);
      setFontQuota(fontData.quota ?? { used: activeFonts.length, limit: 50 });
    } else setFontMessage("Your custom font library could not be loaded.");
    if (googleResponse.ok) setGoogleFonts((await googleResponse.json()).fonts ?? []);
    else setGoogleUnavailable(true);
    const loadedVideo = data.video as Video;
    setVideo({ ...loadedVideo, playbackUrl: data.playbackUrl });
    setCues(data.cues);
    if (loadedVideo.translation_status === "ready") setSubtitleMode("bilingual");
    setSettings({
      font_family: loadedVideo.subtitle_font_source === "google" || loadedVideo.subtitle_font_source === "upload"
        ? loadedVideo.subtitle_font_family?.slice(0, 100) || DEFAULT_SUBTITLE_SETTINGS.font_family
        : isSubtitleFont(loadedVideo.subtitle_font_family) ? loadedVideo.subtitle_font_family : DEFAULT_SUBTITLE_SETTINGS.font_family,
      font_source: isFontSource(loadedVideo.subtitle_font_source) ? loadedVideo.subtitle_font_source : "system",
      user_font_id: loadedVideo.subtitle_font_source === "upload" ? loadedVideo.subtitle_user_font_id ?? null : null,
      text_color: /^#[0-9a-f]{6}$/i.test(loadedVideo.subtitle_text_color ?? "") ? loadedVideo.subtitle_text_color! : DEFAULT_SUBTITLE_SETTINGS.text_color,
      font_size: loadedVideo.subtitle_font_size && loadedVideo.subtitle_font_size >= 12 && loadedVideo.subtitle_font_size <= 64 ? loadedVideo.subtitle_font_size : DEFAULT_SUBTITLE_SETTINGS.font_size,
      bold: loadedVideo.subtitle_bold ?? DEFAULT_SUBTITLE_SETTINGS.bold,
      italic: loadedVideo.subtitle_italic ?? DEFAULT_SUBTITLE_SETTINGS.italic,
      underline: loadedVideo.subtitle_underline ?? DEFAULT_SUBTITLE_SETTINGS.underline,
      strikethrough: loadedVideo.subtitle_strikethrough ?? DEFAULT_SUBTITLE_SETTINGS.strikethrough,
      backdrop_color: /^#[0-9a-f]{6}$/i.test(loadedVideo.subtitle_backdrop_color ?? "") ? loadedVideo.subtitle_backdrop_color! : DEFAULT_SUBTITLE_SETTINGS.backdrop_color,
      backdrop_opacity: loadedVideo.subtitle_backdrop_opacity ?? DEFAULT_SUBTITLE_SETTINGS.backdrop_opacity,
      glow_enabled: loadedVideo.subtitle_glow_enabled ?? DEFAULT_SUBTITLE_SETTINGS.glow_enabled,
      glow_color: /^#[0-9a-f]{6}$/i.test(loadedVideo.subtitle_glow_color ?? "") ? loadedVideo.subtitle_glow_color! : DEFAULT_SUBTITLE_SETTINGS.glow_color,
      glow_blur: loadedVideo.subtitle_glow_blur ?? DEFAULT_SUBTITLE_SETTINGS.glow_blur,
      glow_intensity: loadedVideo.subtitle_glow_intensity ?? DEFAULT_SUBTITLE_SETTINGS.glow_intensity,
      words_per_cue: loadedVideo.words_per_cue ?? DEFAULT_SUBTITLE_SETTINGS.words_per_cue,
      karaoke_enabled: loadedVideo.karaoke_enabled ?? DEFAULT_SUBTITLE_SETTINGS.karaoke_enabled,
      karaoke_color: /^#[0-9a-f]{6}$/i.test(loadedVideo.karaoke_color ?? "") ? loadedVideo.karaoke_color! : DEFAULT_SUBTITLE_SETTINGS.karaoke_color,
    });
    setTranslationStyle({
      font_family: loadedVideo.translation_font_source === "google" || loadedVideo.translation_font_source === "upload"
        ? loadedVideo.translation_font_family?.slice(0, 100) || DEFAULT_TRANSLATION_STYLE.font_family
        : isSubtitleFont(loadedVideo.translation_font_family) ? loadedVideo.translation_font_family : DEFAULT_TRANSLATION_STYLE.font_family,
      font_source: isFontSource(loadedVideo.translation_font_source) ? loadedVideo.translation_font_source : "system",
      user_font_id: loadedVideo.translation_font_source === "upload" ? loadedVideo.translation_user_font_id ?? null : null,
      text_color: /^#[0-9a-f]{6}$/i.test(loadedVideo.translation_text_color ?? "") ? loadedVideo.translation_text_color! : DEFAULT_TRANSLATION_STYLE.text_color,
      font_size: loadedVideo.translation_font_size && loadedVideo.translation_font_size >= 12 && loadedVideo.translation_font_size <= 64 ? loadedVideo.translation_font_size : DEFAULT_TRANSLATION_STYLE.font_size,
      bold: loadedVideo.translation_bold ?? DEFAULT_TRANSLATION_STYLE.bold,
      italic: loadedVideo.translation_italic ?? DEFAULT_TRANSLATION_STYLE.italic,
      underline: loadedVideo.translation_underline ?? DEFAULT_TRANSLATION_STYLE.underline,
      strikethrough: loadedVideo.translation_strikethrough ?? DEFAULT_TRANSLATION_STYLE.strikethrough,
      backdrop_color: /^#[0-9a-f]{6}$/i.test(loadedVideo.translation_backdrop_color ?? "") ? loadedVideo.translation_backdrop_color! : DEFAULT_TRANSLATION_STYLE.backdrop_color,
      backdrop_opacity: loadedVideo.translation_backdrop_opacity ?? DEFAULT_TRANSLATION_STYLE.backdrop_opacity,
      glow_enabled: loadedVideo.translation_glow_enabled ?? DEFAULT_TRANSLATION_STYLE.glow_enabled,
      glow_color: /^#[0-9a-f]{6}$/i.test(loadedVideo.translation_glow_color ?? "") ? loadedVideo.translation_glow_color! : DEFAULT_TRANSLATION_STYLE.glow_color,
      glow_blur: loadedVideo.translation_glow_blur ?? DEFAULT_TRANSLATION_STYLE.glow_blur,
      glow_intensity: loadedVideo.translation_glow_intensity ?? DEFAULT_TRANSLATION_STYLE.glow_intensity,
    });
    setMessage("");
  }, [router, token, videoId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => () => {
    if (playbackFrameRef.current != null) cancelAnimationFrame(playbackFrameRef.current);
  }, []);
  useEffect(() => {
    const styles = [settings, translationStyle, ...cues.flatMap((cue) => cue.style_override ? [cue.style_override] : [])];
    void Promise.all(styles.map(async (style) => {
      if (style.font_source === "google") return loadGoogleFont(style, googleFonts.find((font) => font.family === style.font_family));
      if (style.font_source === "upload" && style.user_font_id) {
        const font = userFonts.find((item) => item.id === style.user_font_id);
        if (!font) throw new Error("Uploaded font metadata is unavailable.");
        return loadUploadedFont(font);
      }
    })).then(() => setFontMessage("")).catch(() => setFontMessage("A selected font could not be loaded. Showing a fallback font."));
  }, [settings, translationStyle, cues, userFonts, googleFonts]);

  function update(index: number, patch: Partial<SubtitleCue>) { setCues((current) => current.map((cue, cueIndex) => cueIndex === index ? { ...cue, ...patch } : cue)); }
  function updateWordStyle(cueIndex: number, wordIndex: number, patch: Partial<SubtitleWordStyle> | null) {
    setCues((current) => current.map((cue, index) => {
      if (index !== cueIndex) return cue;
      const words = timedWordsForCue(cue).map((word, index) => index === wordIndex
        ? { ...word, style: patch === null ? undefined : { ...word.style, ...patch } }
        : word);
      return { ...cue, words };
    }));
  }
  async function save() {
    setMessage("Saving…"); const accessToken = await token();
    const response = await fetch(`/api/videos/${videoId}/subtitles`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ cues, settings, translationStyle }) });
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

  const hasTranslation = video?.translation_status === "ready" && cues.some((cue) => cue.translated_text);
  const targetLanguage = translationLanguageLabel(video?.translation_target_language);
  const activeOriginalStyle = activeCue?.style_override ?? settings;

  const originalCaption = activeCue && (settings.karaoke_enabled || timedWordsForCue(activeCue).some((word) => word.style))
    ? timedWordsForCue(activeCue).map((word, index) => <span key={`${word.start_ms}-${index}`} className="karaoke-word" style={wordStyle(word.style, settings.karaoke_enabled && time >= word.start_ms && time < word.end_ms ? settings.karaoke_color : undefined)}>{word.text}</span>)
    : activeCue?.text;

  return <AppShell><div className="editor-page"><div className="editor-toolbar"><div><span className="section-label">SUBTITLE EDITOR</span><h1>{video?.file_name ?? "Project"}</h1></div><div className="toolbar-actions"><span role="status">{message || fontMessage}</span>{hasTranslation && <label className="track-mode-control">Subtitle track<select value={subtitleMode} onChange={(event) => setSubtitleMode(event.target.value as SubtitleExportMode)}><option value="original">Original only</option><option value="translated">{targetLanguage} only</option><option value="bilingual">Double subtitles</option></select></label>}<button className="secondary-button" onClick={save}>Save changes</button>{["srt", "vtt", "txt"].map((format) => <button key={format} className="primary-button small" onClick={() => download(format)}>↓ {format.toUpperCase()}</button>)}</div></div>
    <div className="editor-workspace"><section className="preview-pane"><div className="player-wrap">{video?.playbackUrl ? <video ref={videoRef} controls preload="metadata" src={video.playbackUrl} onPlay={(event) => { event.currentTarget.defaultMuted = false; event.currentTarget.muted = false; if (event.currentTarget.volume === 0) event.currentTarget.volume = 1; if (playbackFrameRef.current != null) cancelAnimationFrame(playbackFrameRef.current); updatePlaybackTime(); }} onPause={stopPlaybackTimer} onEnded={stopPlaybackTimer} onSeeked={(event) => setTime(event.currentTarget.currentTime * 1000)} onTimeUpdate={(event) => setTime(event.currentTarget.currentTime * 1000)} /> : <div className="player-placeholder">Video preview</div>}{activeCue && <div className="live-caption">{subtitleMode !== "translated" && <span className="caption-line" style={captionStyle(activeOriginalStyle)}>{originalCaption}</span>}{subtitleMode === "bilingual" && activeCue.translated_text && <span className="caption-line translated-caption" style={captionStyle(translationStyle)}>{activeCue.translated_text}</span>}{subtitleMode === "translated" && <span className="caption-line" style={captionStyle(translationStyle)}>{activeCue.translated_text ?? activeCue.text}</span>}</div>}</div><p className="preview-help">{hasTranslation ? `Showing ${subtitleMode === "bilingual" ? "original and translated" : subtitleMode} subtitles. Downloads use this selection.` : "Play the video to preview your edited subtitles in context."}</p>
      <div className="subtitle-controls"><div className="controls-heading"><div><span className="section-label">ORIGINAL APPEARANCE</span><h2>Original subtitle style</h2></div><small>Preview updates instantly</small></div>
        <TrackStyleControls style={settings} name="Original" googleFonts={googleFonts} userFonts={userFonts} googleUnavailable={googleUnavailable} onManageFonts={() => setFontLibraryOpen(true)} onChange={(style) => setSettings((current) => ({ ...current, ...style }))} />
        <div className="control-grid segmentation-controls">
        <div className="control-field range-control words-control"><label htmlFor="words-per-cue">Maximum words per subtitle</label><output htmlFor="words-per-cue">{settings.words_per_cue} words</output><input id="words-per-cue" type="range" min="2" max="16" step="1" value={settings.words_per_cue} onChange={(event) => setSettings((current) => ({ ...current, words_per_cue: Number(event.target.value) }))} /><span className="range-scale"><small>2</small><small>16</small></span><button type="button" className="secondary-button apply-limit" onClick={applyWordLimit}>Apply word limit</button></div>
        <label className="karaoke-toggle"><span><b>Karaoke highlighting</b><small>Highlight each original word as it is spoken</small></span><input type="checkbox" checked={settings.karaoke_enabled} onChange={(event) => setSettings((current) => ({ ...current, karaoke_enabled: event.target.checked }))} /></label>
        <label className="karaoke-color">Highlight color<span className="color-control"><input aria-label="Karaoke highlight color" type="color" value={settings.karaoke_color} disabled={!settings.karaoke_enabled} onChange={(event) => setSettings((current) => ({ ...current, karaoke_color: event.target.value }))} /><output>{settings.karaoke_color.toUpperCase()}</output></span></label>
      </div></div>
      {hasTranslation && <div className="subtitle-controls translation-controls"><div className="controls-heading"><div><span className="section-label">TRANSLATION APPEARANCE</span><h2>{targetLanguage} subtitle style</h2></div><small>Styled independently</small></div><TrackStyleControls style={translationStyle} name={targetLanguage} googleFonts={googleFonts} userFonts={userFonts} googleUnavailable={googleUnavailable} onManageFonts={() => setFontLibraryOpen(true)} onChange={setTranslationStyle} /></div>}
      </section>
    <section className="cue-pane"><div className="cue-head"><b>{cues.length} subtitle cues</b><span>{hasTranslation ? `${video?.language?.toUpperCase() ?? "AUTO"} + ${video?.translation_target_language?.toUpperCase()}` : video?.language?.toUpperCase() ?? "AUTO"}</span></div>{cues.map((cue, index) => <article className={`cue-row ${activeCue?.cue_index === cue.cue_index ? "active" : ""}`} key={cue.id ?? index} onClick={() => { if (videoRef.current) videoRef.current.currentTime = cue.start_ms / 1000; }}><span className="cue-number">{index + 1}</span><div className="time-fields"><input aria-label="Start time in milliseconds" type="number" min="0" value={cue.start_ms} onChange={(e) => update(index, { start_ms: Number(e.target.value) })} /><span>→</span><input aria-label="End time in milliseconds" type="number" min="1" value={cue.end_ms} onChange={(e) => update(index, { end_ms: Number(e.target.value) })} /><small>{formatTimestamp(cue.start_ms, ".")} — {formatTimestamp(cue.end_ms, ".")}</small></div><div className="cue-text-fields"><label><small>Original</small><textarea aria-label={`Original subtitle ${index + 1}`} value={cue.text} onChange={(e) => update(index, { text: e.target.value })} /></label>{cue.translated_text != null && <label><small>{targetLanguage}</small><textarea aria-label={`${targetLanguage} subtitle ${index + 1}`} value={cue.translated_text} onChange={(e) => update(index, { translated_text: e.target.value })} /></label>}<button type="button" className="cue-style-toggle" onClick={(event) => { event.stopPropagation(); setExpandedCue((current) => current === index ? null : index); setSelectedWord(null); }}>{expandedCue === index ? "Hide styling" : cue.style_override || cue.words?.some((word) => word.style) ? "Edit custom styling" : "Customize this line"}</button></div>{expandedCue === index && <div className="cue-style-editor" onClick={(event) => event.stopPropagation()}><div className="cue-style-heading"><b>Line appearance</b>{cue.style_override && <button type="button" onClick={() => update(index, { style_override: null })}>Use project style</button>}</div><TrackStyleControls style={cue.style_override ?? settings} name={`Subtitle ${index + 1}`} googleFonts={googleFonts} userFonts={userFonts} googleUnavailable={googleUnavailable} onManageFonts={() => setFontLibraryOpen(true)} onChange={(style) => update(index, { style_override: style })} /><div className="word-style-editor"><b>Word emphasis</b><small>Select a word, then apply formatting.</small><div className="word-chips">{timedWordsForCue(cue).map((word, wordIndex) => <button type="button" key={`${word.start_ms}-${wordIndex}`} className={`${selectedWord?.cueIndex === index && selectedWord.wordIndex === wordIndex ? "selected" : ""} ${word.style ? "customized" : ""}`} onClick={() => setSelectedWord({ cueIndex: index, wordIndex })}>{word.text.trim()}</button>)}</div>{selectedWord?.cueIndex === index && <div className="word-format-controls"><button type="button" aria-label="Bold selected word" onClick={() => updateWordStyle(index, selectedWord.wordIndex, { bold: !timedWordsForCue(cue)[selectedWord.wordIndex]?.style?.bold })}><b>B</b></button><button type="button" aria-label="Italicize selected word" onClick={() => updateWordStyle(index, selectedWord.wordIndex, { italic: !timedWordsForCue(cue)[selectedWord.wordIndex]?.style?.italic })}><i>I</i></button><button type="button" aria-label="Underline selected word" onClick={() => updateWordStyle(index, selectedWord.wordIndex, { underline: !timedWordsForCue(cue)[selectedWord.wordIndex]?.style?.underline })}><u>U</u></button><input aria-label="Selected word color" type="color" value={timedWordsForCue(cue)[selectedWord.wordIndex]?.style?.text_color ?? (cue.style_override ?? settings).text_color} onChange={(event) => updateWordStyle(index, selectedWord.wordIndex, { text_color: event.target.value })} /><button type="button" className="clear-word-style" onClick={() => updateWordStyle(index, selectedWord.wordIndex, null)}>Clear</button></div>}</div></div>}</article>)}</section></div>{fontLibraryOpen && <FontLibraryPanel fonts={userFonts.filter((font) => !font.archivedAt)} quota={fontQuota} getToken={token} onClose={() => setFontLibraryOpen(false)} onChanged={loadFontLibrary} />}</div></AppShell>;
}
