import { isFontSource, type FontSource } from "@/lib/fonts";

export type SubtitleCue = {
  id?: number;
  cue_index: number;
  start_ms: number;
  end_ms: number;
  text: string;
  translated_text?: string | null;
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
};

export type SubtitleSettings = SubtitleTrackStyle & {
  words_per_cue: number;
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
  words_per_cue: 8,
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
    && Number.isInteger(style.backdrop_opacity) && Number(style.backdrop_opacity) >= 0 && Number(style.backdrop_opacity) <= 100;
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
        bilingual.push({
          cue_index: bilingual.length,
          start_ms: startMs,
          end_ms: Math.max(startMs + 1, endMs),
          text: originalWords.slice(originalStart, originalEnd).join(" "),
          translated_text: translatedWords.slice(translatedStart, translatedEnd).join(" ") || null,
        });
      }
    }
    return bilingual;
  }
  const words = cues.flatMap((cue) => {
    const parts = cue.text.trim().split(/\s+/).filter(Boolean);
    const duration = Math.max(parts.length, cue.end_ms - cue.start_ms);
    return parts.map((text, index) => ({
      text,
      start_ms: Math.round(cue.start_ms + duration * index / parts.length),
      end_ms: Math.round(cue.start_ms + duration * (index + 1) / parts.length),
    }));
  });

  const result: SubtitleCue[] = [];
  let group: typeof words = [];
  const flush = () => {
    if (!group.length) return;
    result.push({
      cue_index: result.length,
      start_ms: group[0].start_ms,
      end_ms: Math.max(group[0].start_ms + 1, group.at(-1)!.end_ms),
      text: group.map((word) => word.text).join(" "),
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