export type SubtitleCue = {
  id?: number;
  cue_index: number;
  start_ms: number;
  end_ms: number;
  text: string;
};

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