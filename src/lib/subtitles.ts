export type SubtitleCue = {
  id?: number;
  cue_index: number;
  start_ms: number;
  end_ms: number;
  text: string;
};

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

export function toSrt(cues: SubtitleCue[]) {
  return cues.map((cue, index) => `${index + 1}\n${formatTimestamp(cue.start_ms)} --> ${formatTimestamp(cue.end_ms)}\n${cue.text.trim()}`).join("\n\n") + "\n";
}

export function toVtt(cues: SubtitleCue[]) {
  const body = cues.map((cue) => `${formatTimestamp(cue.start_ms, ".")} --> ${formatTimestamp(cue.end_ms, ".")}\n${cue.text.trim()}`).join("\n\n");
  return `WEBVTT\n\n${body}\n`;
}

export function toTxt(cues: SubtitleCue[]) {
  return cues.map((cue) => cue.text.trim()).join("\n") + "\n";
}