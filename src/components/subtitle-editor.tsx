"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CaptionOverlay } from "@/components/caption-overlay";
import { FontLibraryPanel } from "@/components/font-library-panel";
import { FontPicker } from "@/components/font-picker";
import { ShareLinkPanel } from "@/components/share-link-panel";
import { VersionHistoryPanel } from "@/components/version-history-panel";
import { loadGoogleFont, loadUploadedFont } from "@/lib/font-loader";
import { type GoogleFont, type UserFont } from "@/lib/fonts";
import { createBrowserSupabase } from "@/lib/supabase";
import { useHistoryState } from "@/lib/use-history-state";
import {
  DEFAULT_SUBTITLE_SETTINGS,
  DEFAULT_TRANSLATION_STYLE,
  findMatchingCueIndexes,
  formatTimestamp,
  parseSubtitleFile,
  READABILITY_LABELS,
  readabilityStats,
  replaceInCues,
  resegmentCues,
  settingsFromVideoRow,
  timedWordsForCue,
  translationLanguageLabel,
  translationStyleFromVideoRow,
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
  onChange: (style: SubtitleTrackStyle, immediate?: boolean) => void;
  onManageFonts: () => void;
}) {
  const patch = (value: Partial<SubtitleTrackStyle>, immediate?: boolean) => onChange({ ...style, ...value }, immediate);
  return <div className="control-grid track-style-grid">
    <FontPicker name={name} style={style} googleFonts={googleFonts} userFonts={userFonts} googleUnavailable={googleUnavailable} onChange={(value) => patch(value, true)} onManageFonts={onManageFonts} />
    <label>Text color<span className="color-control"><input aria-label={`${name} subtitle text color`} type="color" value={style.text_color} onChange={(event) => patch({ text_color: event.target.value })} /><output>{style.text_color.toUpperCase()}</output></span></label>
    <label className="range-control">Font size <output>{style.font_size}px</output><input aria-label={`${name} subtitle font size`} type="range" min="12" max="64" step="1" value={style.font_size} onChange={(event) => patch({ font_size: Number(event.target.value) })} /></label>
    <div className="control-field formatting-control"><span>Text formatting</span><div className="format-buttons"><button type="button" aria-label={`${name} bold`} aria-pressed={style.bold} className={style.bold ? "active" : ""} onClick={() => patch({ bold: !style.bold }, true)}><b>B</b></button><button type="button" aria-label={`${name} italic`} aria-pressed={style.italic} className={style.italic ? "active" : ""} onClick={() => patch({ italic: !style.italic }, true)}><i>I</i></button><button type="button" aria-label={`${name} underline`} aria-pressed={style.underline} className={style.underline ? "active" : ""} onClick={() => patch({ underline: !style.underline }, true)}><u>U</u></button><button type="button" aria-label={`${name} strikethrough`} aria-pressed={style.strikethrough} className={style.strikethrough ? "active" : ""} onClick={() => patch({ strikethrough: !style.strikethrough }, true)}><s>S</s></button></div></div>
    <label>Backdrop color<span className="color-control"><input aria-label={`${name} subtitle backdrop color`} type="color" value={style.backdrop_color} onChange={(event) => patch({ backdrop_color: event.target.value })} /><output>{style.backdrop_color.toUpperCase()}</output></span></label>
    <label className="range-control">Backdrop opacity <output>{style.backdrop_opacity}%</output><input aria-label={`${name} subtitle backdrop opacity`} type="range" min="0" max="100" step="1" value={style.backdrop_opacity} onChange={(event) => patch({ backdrop_opacity: Number(event.target.value) })} /></label>
    <label className="effect-toggle"><span>Glow effect</span><input type="checkbox" checked={style.glow_enabled} onChange={(event) => patch({ glow_enabled: event.target.checked }, true)} /></label>
    <label>Glow color<span className="color-control"><input aria-label={`${name} subtitle glow color`} type="color" value={style.glow_color} disabled={!style.glow_enabled} onChange={(event) => patch({ glow_color: event.target.value })} /><output>{style.glow_color.toUpperCase()}</output></span></label>
    <label className="range-control">Glow blur <output>{style.glow_blur}px</output><input aria-label={`${name} subtitle glow blur`} type="range" min="0" max="40" step="1" value={style.glow_blur} disabled={!style.glow_enabled} onChange={(event) => patch({ glow_blur: Number(event.target.value) })} /></label>
    <label className="range-control">Glow intensity <output>{style.glow_intensity}%</output><input aria-label={`${name} subtitle glow intensity`} type="range" min="0" max="100" step="1" value={style.glow_intensity} disabled={!style.glow_enabled} onChange={(event) => patch({ glow_intensity: Number(event.target.value) })} /></label>
  </div>;
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

type EditableDocument = {
  cues: SubtitleCue[];
  settings: SubtitleSettings;
  translationStyle: SubtitleTrackStyle;
};

export function SubtitleEditor({ videoId }: { videoId: string }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackFrameRef = useRef<number | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const doc = useHistoryState<EditableDocument>({ cues: [], settings: DEFAULT_SUBTITLE_SETTINGS, translationStyle: DEFAULT_TRANSLATION_STYLE });
  const { cues, settings, translationStyle } = doc.value;
  const [userFonts, setUserFonts] = useState<UserFont[]>([]);
  const [googleFonts, setGoogleFonts] = useState<GoogleFont[]>([]);
  const [fontQuota, setFontQuota] = useState({ used: 0, limit: 50 });
  const [googleUnavailable, setGoogleUnavailable] = useState(false);
  const [fontLibraryOpen, setFontLibraryOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [expandedCue, setExpandedCue] = useState<number | null>(null);
  const [selectedWord, setSelectedWord] = useState<{ cueIndex: number; wordIndex: number } | null>(null);
  const [splitCueIndex, setSplitCueIndex] = useState<number | null>(null);
  const [shiftAmount, setShiftAmount] = useState(1);
  const [shiftUnit, setShiftUnit] = useState<"ms" | "s">("s");
  const [selectedCues, setSelectedCues] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const [touchedPanels, setTouchedPanels] = useState<Set<number>>(new Set());
  const [fontMessage, setFontMessage] = useState("");
  const [subtitleMode, setSubtitleMode] = useState<SubtitleExportMode>("original");
  const [time, setTime] = useState(0);
  const [message, setMessage] = useState("Loading subtitles…");
  const activeCue = useMemo(() => cues.find((cue) => time >= cue.start_ms && time < cue.end_ms), [cues, time]);
  const searchMatches = useMemo(() => findMatchingCueIndexes(cues, searchQuery, matchCase), [cues, searchQuery, matchCase]);
  const currentSearchMatchCueIndex = searchMatches.length ? searchMatches[((searchMatchIndex % searchMatches.length) + searchMatches.length) % searchMatches.length] : null;
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
    if (loadedVideo.translation_status === "ready") setSubtitleMode("bilingual");
    doc.reset({
      cues: data.cues,
      settings: settingsFromVideoRow(loadedVideo as unknown as Record<string, unknown>),
      translationStyle: translationStyleFromVideoRow(loadedVideo as unknown as Record<string, unknown>),
    });
    setSelectedCues(new Set());
    setMessage("");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doc.reset has a stable identity; depending on the whole `doc` object would recreate `load` (and retrigger the fetch effect below) every render
  }, [router, token, videoId, doc.reset]);
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
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) { event.preventDefault(); doc.undo(); }
      else if ((key === "z" && event.shiftKey) || key === "y") { event.preventDefault(); doc.redo(); }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doc.undo/doc.redo have stable identities; depending on `doc` would re-bind the listener every render
  }, [doc.undo, doc.redo]);
  useEffect(() => { setSearchMatchIndex(0); }, [searchQuery, matchCase]);

  function update(index: number, patch: Partial<SubtitleCue>, immediate?: boolean) {
    doc.set((current) => ({ ...current, cues: current.cues.map((cue, cueIndex) => cueIndex === index ? { ...cue, ...patch } : cue) }), { immediate });
  }
  function updateWordStyle(cueIndex: number, wordIndex: number, patch: Partial<SubtitleWordStyle> | null, immediate?: boolean) {
    doc.set((current) => ({
      ...current,
      cues: current.cues.map((cue, index) => {
        if (index !== cueIndex) return cue;
        const words = timedWordsForCue(cue).map((word, index) => index === wordIndex
          ? { ...word, style: patch === null ? undefined : { ...word.style, ...patch } }
          : word);
        return { ...cue, words };
      }),
    }), { immediate });
  }
  function patchSettings(patch: Partial<SubtitleSettings>, immediate?: boolean) {
    doc.set((current) => ({ ...current, settings: { ...current.settings, ...patch } }), { immediate });
  }
  function patchTranslationStyle(patch: Partial<SubtitleTrackStyle>, immediate?: boolean) {
    doc.set((current) => ({ ...current, translationStyle: { ...current.translationStyle, ...patch } }), { immediate });
  }
  // Returns whether the save succeeded so the snapshot panel can refuse to snapshot stale state.
  async function save() {
    doc.commitPending();
    setMessage("Saving…"); const accessToken = await token();
    const response = await fetch(`/api/videos/${videoId}/subtitles`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ cues, settings, translationStyle }) });
    const data = await response.json(); setMessage(response.ok ? "All changes saved." : data.error);
    return response.ok;
  }
  function applyWordLimit() {
    doc.set((current) => ({ ...current, cues: resegmentCues(current.cues, current.settings.words_per_cue) }), { immediate: true });
    setMessage(`Subtitles regrouped to ${settings.words_per_cue} words maximum. Save to keep changes.`);
  }
  function toggleCueCustomize(index: number) {
    setExpandedCue((current) => {
      const next = current === index ? null : index;
      if (next !== null) setTouchedPanels((touched) => touched.has(index) ? touched : new Set(touched).add(index));
      return next;
    });
    setSelectedWord(null);
  }
  function toggleCueSelection(index: number) {
    setSelectedCues((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  }
  function shiftAllTimestamps(rawAmount: number) {
    const shiftMs = shiftUnit === "s" ? rawAmount * 1000 : rawAmount;
    if (!shiftMs) return;
    const targetIndexes = selectedCues;
    doc.set((current) => {
      const targets = targetIndexes.size > 0 ? current.cues.filter((_, index) => targetIndexes.has(index)) : current.cues;
      if (!targets.length) return current;
      const minStart = Math.min(...targets.map((cue) => cue.start_ms));
      const effectiveShift = Math.max(shiftMs, -minStart);
      if (!effectiveShift) return current;
      return {
        ...current,
        cues: current.cues.map((cue, index) => targetIndexes.size > 0 && !targetIndexes.has(index) ? cue : {
          ...cue,
          start_ms: cue.start_ms + effectiveShift,
          end_ms: cue.end_ms + effectiveShift,
          words: cue.words?.map((word) => ({ ...word, start_ms: word.start_ms + effectiveShift, end_ms: word.end_ms + effectiveShift })),
        }),
      };
    }, { immediate: true });
    setMessage(targetIndexes.size > 0 ? `Shifted ${targetIndexes.size} selected cue${targetIndexes.size === 1 ? "" : "s"}. Save to keep changes.` : "Shifted all timestamps. Save to keep changes.");
  }
  function splitCue(cueIndex: number, wordIndex: number) {
    doc.set((current) => {
      const cue = current.cues[cueIndex];
      const words = timedWordsForCue(cue);
      if (wordIndex <= 0 || wordIndex >= words.length) return current;
      const firstWords = words.slice(0, wordIndex);
      const secondWords = words.slice(wordIndex);
      const splitMs = Math.max(cue.start_ms + 1, Math.min(cue.end_ms - 1, secondWords[0].start_ms));
      let firstTranslated: string | null = null;
      let secondTranslated: string | null = null;
      if (cue.translated_text?.trim()) {
        const translatedWords = cue.translated_text.trim().split(/\s+/).filter(Boolean);
        const splitAt = Math.round(translatedWords.length * wordIndex / words.length);
        firstTranslated = translatedWords.slice(0, splitAt).join(" ") || null;
        secondTranslated = translatedWords.slice(splitAt).join(" ") || null;
      }
      const first: SubtitleCue = { ...cue, id: undefined, end_ms: splitMs, text: firstWords.map((word) => word.text).join("").trim(), translated_text: firstTranslated, words: firstWords };
      const second: SubtitleCue = { ...cue, id: undefined, start_ms: splitMs, text: secondWords.map((word) => word.text).join("").trim(), translated_text: secondTranslated, words: secondWords };
      const cues = [...current.cues.slice(0, cueIndex), first, second, ...current.cues.slice(cueIndex + 1)]
        .map((cue, index) => ({ ...cue, cue_index: index }));
      return { ...current, cues };
    }, { immediate: true });
    setSplitCueIndex(null); setExpandedCue(null); setSelectedWord(null); setSelectedCues(new Set());
    setMessage("Cue split into two. Save to keep changes.");
  }
  function mergeWithNext(cueIndex: number) {
    doc.set((current) => {
      const cue = current.cues[cueIndex];
      const next = current.cues[cueIndex + 1];
      if (!next) return current;
      const merged: SubtitleCue = {
        ...cue,
        end_ms: next.end_ms,
        text: [cue.text.trim(), next.text.trim()].filter(Boolean).join(" "),
        translated_text: [cue.translated_text?.trim(), next.translated_text?.trim()].filter(Boolean).join(" ") || null,
        words: [...timedWordsForCue(cue), ...timedWordsForCue(next)],
      };
      const cues = [...current.cues.slice(0, cueIndex), merged, ...current.cues.slice(cueIndex + 2)]
        .map((cue, index) => ({ ...cue, cue_index: index }));
      return { ...current, cues };
    }, { immediate: true });
    setSplitCueIndex(null); setExpandedCue(null); setSelectedWord(null); setSelectedCues(new Set());
    setMessage("Cues merged. Save to keep changes.");
  }
  function jumpToMatch(step: number) {
    if (!searchMatches.length) return;
    const current = ((searchMatchIndex % searchMatches.length) + searchMatches.length) % searchMatches.length;
    const next = (current + step + searchMatches.length) % searchMatches.length;
    setSearchMatchIndex(next);
    const cue = cues[searchMatches[next]];
    if (videoRef.current) videoRef.current.currentTime = cue.start_ms / 1000;
    document.getElementById(`cue-row-${searchMatches[next]}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  function replaceAll() {
    if (!searchMatches.length) return;
    const affected = searchMatches.length;
    doc.set((current) => ({ ...current, cues: replaceInCues(current.cues, searchQuery, replaceQuery, matchCase).cues }), { immediate: true });
    setSearchMatchIndex(0);
    setMessage(`Replaced text in ${affected} cue${affected === 1 ? "" : "s"}. Save to keep changes.`);
  }
  async function importSubtitleFile(file: File) {
    const { cues: importedCues, skipped } = parseSubtitleFile(await file.text());
    if (!importedCues.length) return setMessage("No valid subtitle cues found in that file.");
    doc.set((current) => ({ ...current, cues: importedCues }), { immediate: true });
    setSelectedCues(new Set()); setExpandedCue(null); setSelectedWord(null); setSplitCueIndex(null);
    setMessage(`Imported ${importedCues.length} cue${importedCues.length === 1 ? "" : "s"}${skipped.length ? ` (${skipped.length} block${skipped.length === 1 ? "" : "s"} skipped — check formatting)` : ""}. This replaces the current subtitles; save to keep changes.`);
  }
  async function download(format: string) {
    const accessToken = await token();
    const response = await fetch(`/api/videos/${videoId}/export?format=${format}&mode=${subtitleMode}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) return setMessage((await response.json()).error);
    const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    const modeSuffix = hasTranslation ? `.${subtitleMode === "bilingual" ? "bilingual" : subtitleMode === "translated" ? video?.translation_target_language ?? "translated" : video?.language ?? "original"}` : "";
    anchor.href = url; anchor.download = `${video?.file_name.replace(/\.mp4$/i, "")}${modeSuffix}.${format}`; anchor.click(); URL.revokeObjectURL(url);
  }

  const hasTranslation = video?.translation_status === "ready" && cues.some((cue) => cue.translated_text);
  const targetLanguage = translationLanguageLabel(video?.translation_target_language);

  return <AppShell><div className="editor-page"><div className="editor-toolbar"><div><span className="section-label">SUBTITLE EDITOR</span><h1>{video?.file_name ?? "Project"}</h1></div><div className="toolbar-actions"><span role="status">{message || fontMessage}</span>{hasTranslation && <label className="track-mode-control">Subtitle track<select value={subtitleMode} onChange={(event) => setSubtitleMode(event.target.value as SubtitleExportMode)}><option value="original">Original only</option><option value="translated">{targetLanguage} only</option><option value="bilingual">Double subtitles</option></select></label>}<button className="secondary-button" onClick={doc.undo} disabled={!doc.canUndo} title="Undo (Ctrl+Z)">↺ Undo</button><button className="secondary-button" onClick={doc.redo} disabled={!doc.canRedo} title="Redo (Ctrl+Y)">↻ Redo</button><button className="secondary-button" onClick={save}>Save changes</button><button className="secondary-button" onClick={() => setHistoryOpen(true)} title="Save and restore snapshots of this project">⟲ History</button><button className="secondary-button" onClick={() => setShareOpen(true)} title="Create a read-only link to this project">⇗ Share</button><input ref={importInputRef} type="file" accept=".srt,.vtt,text/vtt,application/x-subrip" style={{ display: "none" }} onChange={async (event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) await importSubtitleFile(file); }} /><button className="secondary-button" onClick={() => importInputRef.current?.click()} title="Import an SRT or VTT file, replacing the current subtitles">↑ Import</button>{["srt", "vtt", "txt"].map((format) => <button key={format} className="primary-button small" onClick={() => download(format)}>↓ {format.toUpperCase()}</button>)}</div></div>
    <div className="editor-workspace"><section className="preview-pane"><div className="player-wrap">{video?.playbackUrl ? <video ref={videoRef} controls preload="metadata" src={video.playbackUrl} onPlay={(event) => { event.currentTarget.defaultMuted = false; event.currentTarget.muted = false; if (event.currentTarget.volume === 0) event.currentTarget.volume = 1; if (playbackFrameRef.current != null) cancelAnimationFrame(playbackFrameRef.current); updatePlaybackTime(); }} onPause={stopPlaybackTimer} onEnded={stopPlaybackTimer} onSeeked={(event) => setTime(event.currentTarget.currentTime * 1000)} onTimeUpdate={(event) => setTime(event.currentTarget.currentTime * 1000)} /> : <div className="player-placeholder">Video preview</div>}<CaptionOverlay cue={activeCue} settings={settings} translationStyle={translationStyle} mode={subtitleMode} timeMs={time} /></div><p className="preview-help">{hasTranslation ? `Showing ${subtitleMode === "bilingual" ? "original and translated" : subtitleMode} subtitles. Downloads use this selection.` : "Play the video to preview your edited subtitles in context."}</p>
      <div className="subtitle-controls"><div className="controls-heading"><div><span className="section-label">ORIGINAL APPEARANCE</span><h2>Original subtitle style</h2></div><small>Preview updates instantly</small></div>
        <TrackStyleControls style={settings} name="Original" googleFonts={googleFonts} userFonts={userFonts} googleUnavailable={googleUnavailable} onManageFonts={() => setFontLibraryOpen(true)} onChange={patchSettings} />
        <div className="control-grid segmentation-controls">
        <div className="control-field range-control words-control"><label htmlFor="words-per-cue">Maximum words per subtitle</label><output htmlFor="words-per-cue">{settings.words_per_cue} words</output><input id="words-per-cue" type="range" min="2" max="16" step="1" value={settings.words_per_cue} onChange={(event) => patchSettings({ words_per_cue: Number(event.target.value) })} /><span className="range-scale"><small>2</small><small>16</small></span><button type="button" className="secondary-button apply-limit" onClick={applyWordLimit}>Apply word limit</button></div>
        <label className="karaoke-toggle"><span><b>Karaoke highlighting</b><small>Highlight each original word as it is spoken</small></span><input type="checkbox" checked={settings.karaoke_enabled} onChange={(event) => patchSettings({ karaoke_enabled: event.target.checked }, true)} /></label>
        <label className="karaoke-color">Highlight color<span className="color-control"><input aria-label="Karaoke highlight color" type="color" value={settings.karaoke_color} disabled={!settings.karaoke_enabled} onChange={(event) => patchSettings({ karaoke_color: event.target.value })} /><output>{settings.karaoke_color.toUpperCase()}</output></span></label>
      </div></div>
      {hasTranslation && <div className="subtitle-controls translation-controls"><div className="controls-heading"><div><span className="section-label">TRANSLATION APPEARANCE</span><h2>{targetLanguage} subtitle style</h2></div><small>Styled independently</small></div><TrackStyleControls style={translationStyle} name={targetLanguage} googleFonts={googleFonts} userFonts={userFonts} googleUnavailable={googleUnavailable} onManageFonts={() => setFontLibraryOpen(true)} onChange={patchTranslationStyle} /></div>}
      </section>
    <section className="cue-pane"><div className="cue-head"><b>{cues.length} subtitle cues</b><span>{hasTranslation ? `${video?.language?.toUpperCase() ?? "AUTO"} + ${video?.translation_target_language?.toUpperCase()}` : video?.language?.toUpperCase() ?? "AUTO"}</span></div>
      <div className="cue-bulk-tools"><span>{selectedCues.size > 0 ? `Shift ${selectedCues.size} selected cue${selectedCues.size === 1 ? "" : "s"}` : "Shift all timestamps"}</span><input aria-label="Timestamp shift amount" type="number" min="0" step="any" value={shiftAmount} onChange={(event) => setShiftAmount(Number(event.target.value))} /><select aria-label="Timestamp shift unit" value={shiftUnit} onChange={(event) => setShiftUnit(event.target.value as "ms" | "s")}><option value="s">sec</option><option value="ms">ms</option></select><button type="button" className="secondary-button small" onClick={() => shiftAllTimestamps(-shiftAmount)}>◂ Earlier</button><button type="button" className="secondary-button small" onClick={() => shiftAllTimestamps(shiftAmount)}>Later ▸</button>{selectedCues.size > 0 && <button type="button" className="clear-selection" onClick={() => setSelectedCues(new Set())}>Clear selection</button>}</div>
      <div className="cue-search-tools"><input aria-label="Find text in subtitles" type="text" placeholder="Find" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} /><input aria-label="Replace with" type="text" placeholder="Replace with" value={replaceQuery} onChange={(event) => setReplaceQuery(event.target.value)} /><label className="match-case-toggle" title="Match case"><input type="checkbox" checked={matchCase} onChange={(event) => setMatchCase(event.target.checked)} />Aa</label>{searchQuery.trim() && <span className="match-count">{searchMatches.length ? `${Math.min(searchMatchIndex, searchMatches.length - 1) + 1}/${searchMatches.length}` : "0/0"}</span>}<button type="button" className="secondary-button small" disabled={!searchMatches.length} onClick={() => jumpToMatch(-1)}>◂</button><button type="button" className="secondary-button small" disabled={!searchMatches.length} onClick={() => jumpToMatch(1)}>▸</button><button type="button" className="secondary-button small" disabled={!searchMatches.length} onClick={replaceAll}>Replace all</button></div>
      {cues.map((cue, index) => { const stats = readabilityStats(cue); return <article id={`cue-row-${index}`} className={`cue-row ${activeCue?.cue_index === cue.cue_index ? "active" : ""} ${selectedCues.has(index) ? "selected" : ""} ${currentSearchMatchCueIndex === index ? "search-match" : ""}`} key={cue.id ?? index} onClick={() => { if (videoRef.current) videoRef.current.currentTime = cue.start_ms / 1000; }}><div className="cue-select" onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`Select subtitle ${index + 1} for bulk timestamp shift`} checked={selectedCues.has(index)} onChange={() => toggleCueSelection(index)} /><span className="cue-number">{index + 1}</span></div><div className="time-fields"><input aria-label="Start time in milliseconds" type="number" min="0" value={cue.start_ms} onChange={(e) => update(index, { start_ms: Number(e.target.value) })} onBlur={doc.commitPending} /><span>→</span><input aria-label="End time in milliseconds" type="number" min="1" value={cue.end_ms} onChange={(e) => update(index, { end_ms: Number(e.target.value) })} onBlur={doc.commitPending} /><small>{formatTimestamp(cue.start_ms, ".")} — {formatTimestamp(cue.end_ms, ".")}</small></div><div className="cue-text-fields"><label><small>Original</small><textarea aria-label={`Original subtitle ${index + 1}`} value={cue.text} onChange={(e) => update(index, { text: e.target.value })} onBlur={doc.commitPending} /></label>{cue.translated_text != null && <label><small>{targetLanguage}</small><textarea aria-label={`${targetLanguage} subtitle ${index + 1}`} value={cue.translated_text} onChange={(e) => update(index, { translated_text: e.target.value })} onBlur={doc.commitPending} /></label>}{stats.issues.length > 0 && <div className="cue-readability" title={stats.issues.map((issue) => READABILITY_LABELS[issue]).join(" ")}>⚠ {[stats.issues.includes("cps-high") && `${stats.cps.toFixed(1)} CPS`, stats.issues.includes("wpm-high") && `${Math.round(stats.wpm)} WPM`, stats.issues.includes("duration-short") && "too brief", stats.issues.includes("duration-long") && "too long"].filter(Boolean).join(" · ")}</div>}<div className="cue-edit-actions"><button type="button" disabled={timedWordsForCue(cue).length < 2} onClick={(event) => { event.stopPropagation(); setSplitCueIndex((current) => current === index ? null : index); }}>{splitCueIndex === index ? "Cancel split" : "Split"}</button><button type="button" disabled={index === cues.length - 1} onClick={(event) => { event.stopPropagation(); mergeWithNext(index); }}>Merge ↓</button><button type="button" className={`cue-customize-toggle ${expandedCue === index ? "expanded" : ""} ${cue.style_override || cue.words?.some((word) => word.style) ? "customized" : ""}`} aria-expanded={expandedCue === index} onClick={(event) => { event.stopPropagation(); toggleCueCustomize(index); }}>Customize <span className="chevron">▼</span></button></div>{splitCueIndex === index && <div className="cue-split-picker" onClick={(event) => event.stopPropagation()}><small>Click the word where the new subtitle should begin.</small><div className="word-chips">{timedWordsForCue(cue).map((word, wordIndex) => <button type="button" key={`${word.start_ms}-${wordIndex}`} disabled={wordIndex === 0} onClick={() => splitCue(index, wordIndex)}>{word.text.trim()}</button>)}</div></div>}</div>{touchedPanels.has(index) && <div className={`cue-style-collapse ${expandedCue === index ? "expanded" : ""}`}><div className="cue-style-collapse-inner"><div className="cue-style-editor" onClick={(event) => event.stopPropagation()}><div className="cue-style-heading"><b>Line appearance</b>{cue.style_override && <button type="button" onClick={() => update(index, { style_override: null }, true)}>Use project style</button>}</div><TrackStyleControls style={cue.style_override ?? settings} name={`Subtitle ${index + 1}`} googleFonts={googleFonts} userFonts={userFonts} googleUnavailable={googleUnavailable} onManageFonts={() => setFontLibraryOpen(true)} onChange={(style, immediate) => update(index, { style_override: style }, immediate)} /><div className="word-style-editor"><b>Word emphasis</b><small>Select a word, then apply formatting.</small><div className="word-chips">{timedWordsForCue(cue).map((word, wordIndex) => <button type="button" key={`${word.start_ms}-${wordIndex}`} className={`${selectedWord?.cueIndex === index && selectedWord.wordIndex === wordIndex ? "selected" : ""} ${word.style ? "customized" : ""}`} onClick={() => setSelectedWord({ cueIndex: index, wordIndex })}>{word.text.trim()}</button>)}</div>{selectedWord?.cueIndex === index && <div className="word-format-controls"><button type="button" aria-label="Bold selected word" onClick={() => updateWordStyle(index, selectedWord.wordIndex, { bold: !timedWordsForCue(cue)[selectedWord.wordIndex]?.style?.bold }, true)}><b>B</b></button><button type="button" aria-label="Italicize selected word" onClick={() => updateWordStyle(index, selectedWord.wordIndex, { italic: !timedWordsForCue(cue)[selectedWord.wordIndex]?.style?.italic }, true)}><i>I</i></button><button type="button" aria-label="Underline selected word" onClick={() => updateWordStyle(index, selectedWord.wordIndex, { underline: !timedWordsForCue(cue)[selectedWord.wordIndex]?.style?.underline }, true)}><u>U</u></button><input aria-label="Selected word color" type="color" value={timedWordsForCue(cue)[selectedWord.wordIndex]?.style?.text_color ?? (cue.style_override ?? settings).text_color} onChange={(event) => updateWordStyle(index, selectedWord.wordIndex, { text_color: event.target.value })} /><button type="button" className="clear-word-style" onClick={() => updateWordStyle(index, selectedWord.wordIndex, null, true)}>Clear</button></div>}</div></div></div></div>}</article>; })}</section></div>{fontLibraryOpen && <FontLibraryPanel fonts={userFonts.filter((font) => !font.archivedAt)} quota={fontQuota} getToken={token} onClose={() => setFontLibraryOpen(false)} onChanged={loadFontLibrary} />}{historyOpen && <VersionHistoryPanel videoId={videoId} getToken={token} saveCurrentChanges={save} onRestored={load} onClose={() => setHistoryOpen(false)} />}{shareOpen && <ShareLinkPanel videoId={videoId} getToken={token} onClose={() => setShareOpen(false)} />}</div></AppShell>;
}
