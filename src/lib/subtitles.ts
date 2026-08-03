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

export type SubtitleSettings = SubtitleTrackStyle & {
  words_per_cue: number;
  karaoke_enabled: boolean;
  karaoke_color: string;
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
        });
      }
    }
    return bilingual;
  }
  const words = cues.flatMap(timedWordsForCue);

  const result: SubtitleCue[] = [];
  let group: typeof words = [];
  const flush = () => {
    if (!group.length) return;
    result.push({
      cue_index: result.length,
      start_ms: group[0].start_ms,
      end_ms: Math.max(group[0].start_ms + 1, group.at(-1)!.end_ms),
      text: group.map((word) => word.text).join("").trim(),
      words: group,
    });
    group = [];
  };

  for (const word of words) {
    if (group.length && (group.length >= wordLimit || word.start_ms - group.at(-1)!.end_ms > 1_000)) flush();
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

export function toSrt(cues: SubtitleCue[], mode: SubtitleExportMode = "original") {
  return cues.map((cue, index) => `${index + 1}\n${formatTimestamp(cue.start_ms)} --> ${formatTimestamp(cue.end_ms)}\n${cueText(cue, mode)}`).join("\n\n") + "\n";
}

export function toVtt(cues: SubtitleCue[], mode: SubtitleExportMode = "original") {
  const body = cues.map((cue) => `${formatTimestamp(cue.start_ms, ".")} --> ${formatTimestamp(cue.end_ms, ".")}\n${cueText(cue, mode)}`).join("\n\n");
  return `WEBVTT\n\n${body}\n`;
}

export function toTxt(cues: SubtitleCue[], mode: SubtitleExportMode = "original") {
  return cues.map((cue) => cueText(cue, mode)).join("\n") + "\n";
}

export type ParsedSubtitleFile = {
  cues: SubtitleCue[];
  skipped: string[];
};

const IMPORT_TIMESTAMP = /(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})/;

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
    const text = lines.slice(timestampLineIndex + 1).join(" ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!text) { skipped.push(`Block ${blockNumber + 1}: subtitle text is empty.`); return; }
    cues.push({ cue_index: 0, start_ms, end_ms, text });
  });
  cues.sort((a, b) => a.start_ms - b.start_ms);
  cues.forEach((cue, index) => { cue.cue_index = index; });
  return { cues, skipped };
}