import { isFontSource, type FontSource } from "@/lib/fonts";

export type SubtitleCue = {
  id?: number;
  cue_index: number;
  start_ms: number;
  end_ms: number;
  text: string;
  translated_text?: string | null;
  words?: SubtitleWord[] | null;
  style_override?: SubtitleTrackStyle | null;
  /** Who says this line. Null/absent means unattributed — the state of every cue until someone labels it. */
  speaker?: string | null;
};

export type SubtitleWordStyle = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  text_color?: string;
};

export type SubtitleWord = {
  text: string;
  start_ms: number;
  end_ms: number;
  style?: SubtitleWordStyle;
};

export const TRANSLATION_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "tl", label: "Tagalog / Filipino" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "ja", label: "Japanese" },
  { code: "zh", label: "Chinese / Mandarin" },
  { code: "ko", label: "Korean" },
  { code: "hi", label: "Hindi" },
  { code: "ar", label: "Arabic" },
  { code: "id", label: "Indonesian" },
  { code: "ms", label: "Malay" },
  { code: "vi", label: "Vietnamese" },
] as const;

export type TranslationLanguage = (typeof TRANSLATION_LANGUAGES)[number]["code"];

export function isTranslationLanguage(value: unknown): value is TranslationLanguage {
  return typeof value === "string" && TRANSLATION_LANGUAGES.some((language) => language.code === value);
}

export function translationLanguageLabel(code?: string | null) {
  return TRANSLATION_LANGUAGES.find((language) => language.code === code)?.label ?? code?.toUpperCase() ?? "Translation";
}

export const SUBTITLE_FONTS = [
  "Arial",
  "Helvetica",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Times New Roman",
  "Georgia",
  "Segoe UI",
  "Calibri",
  "Courier New",
] as const;

export type SubtitleFont = (typeof SUBTITLE_FONTS)[number];

export type SubtitleTrackStyle = {
  font_family: string;
  font_source: FontSource;
  user_font_id: string | null;
  text_color: string;
  font_size: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  backdrop_color: string;
  backdrop_opacity: number;
  glow_enabled: boolean;
  glow_color: string;
  glow_blur: number;
  glow_intensity: number;
};

export const SPEAKER_LABEL_STYLES = [
  { value: "colon", label: "Maria:" },
  { value: "chevron", label: ">> Maria:" },
  { value: "brackets", label: "[Maria]" },
] as const;

export type SpeakerLabelStyle = (typeof SPEAKER_LABEL_STYLES)[number]["value"];

export function isSpeakerLabelStyle(value: unknown): value is SpeakerLabelStyle {
  return typeof value === "string" && SPEAKER_LABEL_STYLES.some((style) => style.value === value);
}

/** The visible form of a speaker label, without the trailing space that separates it from dialogue. */
export function formatSpeakerLabel(speaker: string, style: SpeakerLabelStyle) {
  const name = speaker.trim();
  if (!name) return "";
  return style === "brackets" ? `[${name}]` : style === "chevron" ? `>> ${name}:` : `${name}:`;
}

export type SubtitleSettings = SubtitleTrackStyle & {
  words_per_cue: number;
  karaoke_enabled: boolean;
  karaoke_color: string;
  speaker_labels_enabled: boolean;
  speaker_label_style: SpeakerLabelStyle;
  speaker_label_color: string;
  sound_markers_enabled: boolean;
  sound_marker_color: string;
};

export const DEFAULT_SUBTITLE_SETTINGS: SubtitleSettings = {
  font_family: "Arial",
  font_source: "system",
  user_font_id: null,
  text_color: "#FFFFFF",
  font_size: 23,
  bold: true,
  italic: false,
  underline: false,
  strikethrough: false,
  backdrop_color: "#000000",
  backdrop_opacity: 82,
  glow_enabled: false,
  glow_color: "#A78BFA",
  glow_blur: 8,
  glow_intensity: 50,
  words_per_cue: 8,
  karaoke_enabled: false,
  karaoke_color: "#A78BFA",
  speaker_labels_enabled: false,
  speaker_label_style: "colon",
  speaker_label_color: "#FFD479",
  sound_markers_enabled: true,
  sound_marker_color: "#9CE0C4",
};

export const DEFAULT_TRANSLATION_STYLE: SubtitleTrackStyle = {
  font_family: "Arial",
  font_source: "system",
  user_font_id: null,
  text_color: "#D8CEFF",
  font_size: 19,
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  backdrop_color: "#000000",
  backdrop_opacity: 82,
  glow_enabled: false,
  glow_color: "#A78BFA",
  glow_blur: 8,
  glow_intensity: 50,
};

export function isSubtitleFont(value: unknown): value is SubtitleFont {
  return typeof value === "string" && SUBTITLE_FONTS.some((font) => font === value);
}

const isHexColor = (value: unknown): value is string => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

// Turns the flat `videos.subtitle_*` / `videos.translation_*` columns into a style object,
// substituting defaults for anything missing or out of range. Used by the editor and by the
// read-only share view so both render a project from the same normalization rules.
function trackStyleFromVideoRow(row: Record<string, unknown>, prefix: "subtitle" | "translation", defaults: SubtitleTrackStyle): SubtitleTrackStyle {
  const read = (key: string) => row[`${prefix}_${key}`];
  const fontSource = isFontSource(read("font_source")) ? read("font_source") as FontSource : "system";
  const fontFamily = read("font_family");
  const userFontId = read("user_font_id");
  const inRange = (key: string, min: number, max: number, fallback: number) => {
    const value = read(key);
    return typeof value === "number" && value >= min && value <= max ? value : fallback;
  };
  const flag = (key: string, fallback: boolean) => typeof read(key) === "boolean" ? read(key) as boolean : fallback;
  const color = (key: string, fallback: string) => isHexColor(read(key)) ? read(key) as string : fallback;
  return {
    font_family: fontSource === "google" || fontSource === "upload"
      ? (typeof fontFamily === "string" ? fontFamily.slice(0, 100) : "") || defaults.font_family
      : isSubtitleFont(fontFamily) ? fontFamily : defaults.font_family,
    font_source: fontSource,
    user_font_id: fontSource === "upload" && typeof userFontId === "string" ? userFontId : null,
    text_color: color("text_color", defaults.text_color),
    font_size: inRange("font_size", 12, 64, defaults.font_size),
    bold: flag("bold", defaults.bold),
    italic: flag("italic", defaults.italic),
    underline: flag("underline", defaults.underline),
    strikethrough: flag("strikethrough", defaults.strikethrough),
    backdrop_color: color("backdrop_color", defaults.backdrop_color),
    backdrop_opacity: inRange("backdrop_opacity", 0, 100, defaults.backdrop_opacity),
    glow_enabled: flag("glow_enabled", defaults.glow_enabled),
    glow_color: color("glow_color", defaults.glow_color),
    glow_blur: inRange("glow_blur", 0, 40, defaults.glow_blur),
    glow_intensity: inRange("glow_intensity", 0, 100, defaults.glow_intensity),
  };
}

export function settingsFromVideoRow(row: Record<string, unknown>): SubtitleSettings {
  const wordsPerCue = row.words_per_cue;
  return {
    ...trackStyleFromVideoRow(row, "subtitle", DEFAULT_SUBTITLE_SETTINGS),
    words_per_cue: typeof wordsPerCue === "number" && wordsPerCue >= 2 && wordsPerCue <= 16 ? wordsPerCue : DEFAULT_SUBTITLE_SETTINGS.words_per_cue,
    karaoke_enabled: typeof row.karaoke_enabled === "boolean" ? row.karaoke_enabled : DEFAULT_SUBTITLE_SETTINGS.karaoke_enabled,
    karaoke_color: isHexColor(row.karaoke_color) ? row.karaoke_color : DEFAULT_SUBTITLE_SETTINGS.karaoke_color,
    speaker_labels_enabled: typeof row.speaker_labels_enabled === "boolean" ? row.speaker_labels_enabled : DEFAULT_SUBTITLE_SETTINGS.speaker_labels_enabled,
    speaker_label_style: isSpeakerLabelStyle(row.speaker_label_style) ? row.speaker_label_style : DEFAULT_SUBTITLE_SETTINGS.speaker_label_style,
    speaker_label_color: isHexColor(row.speaker_label_color) ? row.speaker_label_color : DEFAULT_SUBTITLE_SETTINGS.speaker_label_color,
    sound_markers_enabled: typeof row.sound_markers_enabled === "boolean" ? row.sound_markers_enabled : DEFAULT_SUBTITLE_SETTINGS.sound_markers_enabled,
    sound_marker_color: isHexColor(row.sound_marker_color) ? row.sound_marker_color : DEFAULT_SUBTITLE_SETTINGS.sound_marker_color,
  };
}

export function translationStyleFromVideoRow(row: Record<string, unknown>): SubtitleTrackStyle {
  return trackStyleFromVideoRow(row, "translation", DEFAULT_TRANSLATION_STYLE);
}

export function isSubtitleTrackStyle(value: unknown): value is SubtitleTrackStyle {
  if (!value || typeof value !== "object") return false;
  const style = value as Record<string, unknown>;
  const validSelection = isFontSource(style.font_source)
    && typeof style.font_family === "string" && style.font_family.trim().length >= 1 && style.font_family.length <= 100
    && (style.font_source === "system" ? isSubtitleFont(style.font_family) && style.user_font_id === null
      : style.font_source === "google" ? style.user_font_id === null
        : typeof style.user_font_id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(style.user_font_id));
  return validSelection
    && typeof style.text_color === "string" && /^#[0-9a-f]{6}$/i.test(style.text_color)
    && Number.isInteger(style.font_size) && Number(style.font_size) >= 12 && Number(style.font_size) <= 64
    && typeof style.bold === "boolean" && typeof style.italic === "boolean"
    && typeof style.underline === "boolean" && typeof style.strikethrough === "boolean"
    && typeof style.backdrop_color === "string" && /^#[0-9a-f]{6}$/i.test(style.backdrop_color)
    && Number.isInteger(style.backdrop_opacity) && Number(style.backdrop_opacity) >= 0 && Number(style.backdrop_opacity) <= 100
    && typeof style.glow_enabled === "boolean"
    && typeof style.glow_color === "string" && /^#[0-9a-f]{6}$/i.test(style.glow_color)
    && Number.isInteger(style.glow_blur) && Number(style.glow_blur) >= 0 && Number(style.glow_blur) <= 40
    && Number.isInteger(style.glow_intensity) && Number(style.glow_intensity) >= 0 && Number(style.glow_intensity) <= 100;
}

export function isSubtitleWordStyle(value: unknown): value is SubtitleWordStyle {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const style = value as Record<string, unknown>;
  const keys = Object.keys(style);
  return keys.length > 0 && keys.every((key) => ["bold", "italic", "underline", "text_color"].includes(key))
    && (style.bold === undefined || typeof style.bold === "boolean")
    && (style.italic === undefined || typeof style.italic === "boolean")
    && (style.underline === undefined || typeof style.underline === "boolean")
    && (style.text_color === undefined || typeof style.text_color === "string" && /^#[0-9a-f]{6}$/i.test(style.text_color));
}

export function hasValidWordTimings(value: unknown): value is SubtitleWord[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 500 && value.every((word) => {
    if (!word || typeof word !== "object") return false;
    const item = word as Record<string, unknown>;
    return typeof item.text === "string" && item.text.trim().length > 0 && item.text.length <= 200
      && Number.isFinite(item.start_ms) && Number.isFinite(item.end_ms)
      && Number(item.start_ms) >= 0 && Number(item.end_ms) > Number(item.start_ms)
      && (item.style === undefined || isSubtitleWordStyle(item.style));
  });
}

export function timedWordsForCue(cue: SubtitleCue): SubtitleWord[] {
  if (hasValidWordTimings(cue.words)
    && cue.words.map((word) => word.text).join("").trim().replace(/\s+/g, " ") === cue.text.trim().replace(/\s+/g, " ")) {
    return cue.words.map((word) => {
      const startMs = Math.max(cue.start_ms, Math.min(cue.end_ms - 1, Math.round(word.start_ms)));
      return {
        text: word.text,
        start_ms: startMs,
        end_ms: Math.max(startMs + 1, Math.min(cue.end_ms, Math.round(word.end_ms))),
        ...(word.style ? { style: word.style } : {}),
      };
    });
  }
  const parts = cue.text.match(/\S+\s*/g) ?? [];
  const duration = Math.max(parts.length, cue.end_ms - cue.start_ms);
  return parts.map((text, index) => ({
    text,
    start_ms: Math.round(cue.start_ms + duration * index / parts.length),
    end_ms: Math.round(cue.start_ms + duration * (index + 1) / parts.length),
  }));
}

/**
 * Non-speech accessibility markers — `[door slams]`, `(laughter)`, `♪ lyrics ♪`, a bare `♪`.
 * These are recognized inside a cue's own text rather than stored in a column, so markers survive
 * import, export, search/replace, and split/merge for free, and a file transcribed elsewhere gets
 * marker styling with no data migration. Paired `♪ … ♪` is matched before a lone `♪`.
 */
const ACCESSIBILITY_MARKER = /\[[^\]]*\]|\([^)]*\)|♪[^♪]*♪|♪/g;

export type MarkedWord = SubtitleWord & { marker: boolean };

/** Character ranges within `text` occupied by accessibility markers, in order. */
export function accessibilityMarkerRanges(text: string): [number, number][] {
  return [...text.matchAll(ACCESSIBILITY_MARKER)].map((match) => [match.index, match.index + match[0].length]);
}

export function hasAccessibilityMarker(text: string) {
  return accessibilityMarkerRanges(text).length > 0;
}

/** Splits a caption line into alternating dialogue and marker runs for rendering. */
export function splitCaptionSegments(text: string): { text: string; marker: boolean }[] {
  const segments: { text: string; marker: boolean }[] = [];
  let cursor = 0;
  for (const [from, to] of accessibilityMarkerRanges(text)) {
    if (from > cursor) segments.push({ text: text.slice(cursor, from), marker: false });
    segments.push({ text: text.slice(from, to), marker: true });
    cursor = to;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), marker: false });
  return segments;
}

/**
 * `timedWordsForCue` plus a per-word flag for whether the word falls inside a marker. Words are
 * re-anchored against the cue text by search rather than by running offset, so the karaoke path
 * and the marker path agree even when word tokens were produced by the whitespace fallback.
 */
export function markedWordsForCue(cue: SubtitleCue): MarkedWord[] {
  const words = timedWordsForCue(cue);
  const ranges = accessibilityMarkerRanges(cue.text);
  if (!ranges.length) return words.map((word) => ({ ...word, marker: false }));
  let cursor = 0;
  return words.map((word) => {
    const token = word.text.trim();
    const found = token ? cue.text.indexOf(token, cursor) : -1;
    const from = found === -1 ? cursor : found;
    const to = from + token.length;
    cursor = to;
    return { ...word, marker: ranges.some(([start, end]) => from < end && to > start) };
  });
}

export function resegmentCues(cues: SubtitleCue[], maximumWords: number) {
  const wordLimit = Math.max(2, Math.min(16, Math.round(maximumWords)));
  if (cues.some((cue) => cue.translated_text)) {
    const bilingual: SubtitleCue[] = [];
    for (const cue of cues) {
      const originalWords = cue.text.trim().split(/\s+/).filter(Boolean);
      const translatedWords = cue.translated_text?.trim().split(/\s+/).filter(Boolean) ?? [];
      const groupCount = Math.max(1, Math.ceil(originalWords.length / wordLimit));
      for (let groupIndex = 0; groupIndex < groupCount; groupIndex++) {
        const originalStart = groupIndex * wordLimit;
        const originalEnd = Math.min(originalWords.length, originalStart + wordLimit);
        const startRatio = originalStart / originalWords.length;
        const endRatio = originalEnd / originalWords.length;
        const translatedStart = Math.round(startRatio * translatedWords.length);
        const translatedEnd = Math.round(endRatio * translatedWords.length);
        const startMs = Math.round(cue.start_ms + (cue.end_ms - cue.start_ms) * startRatio);
        const endMs = Math.round(cue.start_ms + (cue.end_ms - cue.start_ms) * endRatio);
        const words = timedWordsForCue(cue).slice(originalStart, originalEnd);
        bilingual.push({
          cue_index: bilingual.length,
          start_ms: startMs,
          end_ms: Math.max(startMs + 1, endMs),
          text: originalWords.slice(originalStart, originalEnd).join(" "),
          translated_text: translatedWords.slice(translatedStart, translatedEnd).join(" ") || null,
          words,
          speaker: cue.speaker ?? null,
        });
      }
    }
    return bilingual;
  }
  // Each word carries its source cue's speaker so regrouping can break on a speaker change —
  // otherwise "Apply word limit" would merge two people into one cue and drop one of the labels.
  const words = cues.flatMap((cue) => timedWordsForCue(cue).map((word) => ({ ...word, speaker: cue.speaker?.trim() || null })));

  const result: SubtitleCue[] = [];
  let group: typeof words = [];
  const flush = () => {
    if (!group.length) return;
    result.push({
      cue_index: result.length,
      start_ms: group[0].start_ms,
      end_ms: Math.max(group[0].start_ms + 1, group.at(-1)!.end_ms),
      text: group.map((word) => word.text).join("").trim(),
      words: group.map((word) => ({ text: word.text, start_ms: word.start_ms, end_ms: word.end_ms, ...(word.style ? { style: word.style } : {}) })),
      speaker: group[0].speaker,
    });
    group = [];
  };

  for (const word of words) {
    if (group.length && (group.length >= wordLimit || word.start_ms - group.at(-1)!.end_ms > 1_000 || word.speaker !== group.at(-1)!.speaker)) flush();
    group.push(word);
  }
  flush();
  return result;
}

export function findMatchingCueIndexes(cues: SubtitleCue[], query: string, matchCase = false): number[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const needle = matchCase ? trimmed : trimmed.toLowerCase();
  return cues.reduce<number[]>((indexes, cue, index) => {
    const haystack = matchCase ? cue.text : cue.text.toLowerCase();
    if (haystack.includes(needle)) indexes.push(index);
    return indexes;
  }, []);
}

export function replaceInCues(cues: SubtitleCue[], query: string, replacement: string, matchCase = false): { cues: SubtitleCue[]; count: number } {
  const trimmed = query.trim();
  if (!trimmed) return { cues, count: 0 };
  const pattern = new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), matchCase ? "g" : "gi");
  let count = 0;
  const nextCues = cues.map((cue) => {
    const matches = cue.text.match(pattern);
    if (!matches) return cue;
    count += matches.length;
    return { ...cue, text: cue.text.replace(pattern, replacement) };
  });
  return { cues: nextCues, count };
}

export type ReadabilityIssue = "cps-high" | "wpm-high" | "duration-short" | "duration-long";

export type ReadabilityStats = {
  durationMs: number;
  characterCount: number;
  wordCount: number;
  cps: number;
  wpm: number;
  issues: ReadabilityIssue[];
};

const MAX_CPS = 21;
const MAX_WPM = 200;
const MIN_DURATION_MS = 833;
const MAX_DURATION_MS = 7000;

export const READABILITY_LABELS: Record<ReadabilityIssue, string> = {
  "cps-high": "Reading speed exceeds 21 characters/second",
  "wpm-high": "Reading speed exceeds 200 words/minute",
  "duration-short": "Displayed for under 0.83s — too brief to read",
  "duration-long": "Displayed for over 7s — consider splitting",
};

export function readabilityStats(cue: SubtitleCue): ReadabilityStats {
  const durationMs = Math.max(0, cue.end_ms - cue.start_ms);
  const characterCount = cue.text.replace(/\s+/g, "").length;
  const wordCount = cue.text.trim().split(/\s+/).filter(Boolean).length;
  const seconds = durationMs / 1000;
  const cps = seconds > 0 ? characterCount / seconds : 0;
  const wpm = seconds > 0 ? (wordCount / seconds) * 60 : 0;
  const issues: ReadabilityIssue[] = [];
  if (durationMs > 0 && durationMs < MIN_DURATION_MS) issues.push("duration-short");
  if (durationMs > MAX_DURATION_MS) issues.push("duration-long");
  if (cps > MAX_CPS) issues.push("cps-high");
  if (wpm > MAX_WPM) issues.push("wpm-high");
  return { durationMs, characterCount, wordCount, cps, wpm, issues };
}

function pad(value: number, length = 2) {
  return String(value).padStart(length, "0");
}

export function formatTimestamp(milliseconds: number, separator: "," | "." = ",") {
  const safe = Math.max(0, Math.round(milliseconds));
  const hours = Math.floor(safe / 3_600_000);
  const minutes = Math.floor((safe % 3_600_000) / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1000);
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}${separator}${pad(safe % 1000, 3)}`;
}

export type SubtitleExportMode = "original" | "translated" | "bilingual";

function cueText(cue: SubtitleCue, mode: SubtitleExportMode = "original") {
  if (!cue.translated_text?.trim() || mode === "original") return cue.text.trim();
  return mode === "bilingual" ? `${cue.text.trim()}\n${cue.translated_text.trim()}` : cue.translated_text.trim();
}

/**
 * Speaker prefixes are opt-in on every format: passing no style leaves exports byte-identical to
 * what they were before speaker labels existed, so turning the feature on in the editor is what
 * changes a download's shape — never an upgrade.
 */
function speakerPrefixed(cue: SubtitleCue, mode: SubtitleExportMode, style?: SpeakerLabelStyle | null) {
  const label = style && cue.speaker?.trim() ? formatSpeakerLabel(cue.speaker, style) : "";
  return label ? `${label} ${cueText(cue, mode)}` : cueText(cue, mode);
}

export function toSrt(cues: SubtitleCue[], mode: SubtitleExportMode = "original", speakerStyle?: SpeakerLabelStyle | null) {
  return cues.map((cue, index) => `${index + 1}\n${formatTimestamp(cue.start_ms)} --> ${formatTimestamp(cue.end_ms)}\n${speakerPrefixed(cue, mode, speakerStyle)}`).join("\n\n") + "\n";
}

/**
 * VTT gets the speaker as a native `<v Maria>` voice span rather than a text prefix: players
 * style it themselves, and it is the one form this project's own import parser can read back.
 */
export function toVtt(cues: SubtitleCue[], mode: SubtitleExportMode = "original", speakerStyle?: SpeakerLabelStyle | null) {
  const body = cues.map((cue) => {
    const speaker = speakerStyle && cue.speaker?.trim() ? cue.speaker.trim().replace(/[<>\n]/g, " ") : "";
    const text = cueText(cue, mode);
    return `${formatTimestamp(cue.start_ms, ".")} --> ${formatTimestamp(cue.end_ms, ".")}\n${speaker ? `<v ${speaker}>${text}</v>` : text}`;
  }).join("\n\n");
  return `WEBVTT\n\n${body}\n`;
}

export function toTxt(cues: SubtitleCue[], mode: SubtitleExportMode = "original", speakerStyle?: SpeakerLabelStyle | null) {
  return cues.map((cue) => speakerPrefixed(cue, mode, speakerStyle)).join("\n") + "\n";
}

export type ParsedSubtitleFile = {
  cues: SubtitleCue[];
  skipped: string[];
};

const IMPORT_TIMESTAMP = /(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})/;

// WebVTT voice span, optionally carrying classes (`<v.loud Maria>`). This is the only speaker
// notation read on import: a textual `Maria:` prefix is indistinguishable from dialogue such as
// "Note: bring it tomorrow", so guessing there would corrupt more files than it would label.
const IMPORT_VOICE_SPAN = /<v(?:\.[^\s>]+)*\s+([^>]+)>/i;

function importTimestampToMs(hours: string, minutes: string, seconds: string, milliseconds: string) {
  return (Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)) * 1000 + Number(milliseconds.padEnd(3, "0").slice(0, 3));
}

// Tolerant of both SRT (",") and VTT (".") millisecond separators, so one parser covers both formats — see ROADMAP.md Phase 2.
export function parseSubtitleFile(content: string): ParsedSubtitleFile {
  const normalized = content.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const blocks = normalized.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const cues: SubtitleCue[] = [];
  const skipped: string[] = [];
  blocks.forEach((block, blockNumber) => {
    if (/^WEBVTT/i.test(block) || /^NOTE\b/.test(block) || /^STYLE\b/.test(block)) return;
    const lines = block.split("\n");
    const timestampLineIndex = lines.findIndex((line) => IMPORT_TIMESTAMP.test(line));
    if (timestampLineIndex === -1) { skipped.push(`Block ${blockNumber + 1}: no valid timestamp line found.`); return; }
    const match = lines[timestampLineIndex].match(IMPORT_TIMESTAMP)!;
    const start_ms = importTimestampToMs(match[1], match[2], match[3], match[4]);
    const end_ms = importTimestampToMs(match[5], match[6], match[7], match[8]);
    if (!(end_ms > start_ms)) { skipped.push(`Block ${blockNumber + 1}: end time is not after start time.`); return; }
    const body = lines.slice(timestampLineIndex + 1).join(" ");
    const speaker = body.match(IMPORT_VOICE_SPAN)?.[1].trim().slice(0, 60);
    const text = body.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!text) { skipped.push(`Block ${blockNumber + 1}: subtitle text is empty.`); return; }
    cues.push({ cue_index: 0, start_ms, end_ms, text, ...(speaker ? { speaker } : {}) });
  });
  cues.sort((a, b) => a.start_ms - b.start_ms);
  cues.forEach((cue, index) => { cue.cue_index = index; });
  return { cues, skipped };
}