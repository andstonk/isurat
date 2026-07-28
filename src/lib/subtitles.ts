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

export type SubtitleSettings = {
  font_family: SubtitleFont;
  text_color: string;
  font_size: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  backdrop_color: string;
  backdrop_opacity: number;
  words_per_cue: number;
};

export const DEFAULT_SUBTITLE_SETTINGS: SubtitleSettings = {
  font_family: "Arial",
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

export function isSubtitleFont(value: unknown): value is SubtitleFont {
  return typeof value === "string" && SUBTITLE_FONTS.some((font) => font === value);
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