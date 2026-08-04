"use client";

import { resolvedFontFamily } from "@/lib/font-loader";
import { timedWordsForCue, type SubtitleCue, type SubtitleExportMode, type SubtitleSettings, type SubtitleTrackStyle, type SubtitleWordStyle } from "@/lib/subtitles";

export function captionStyle(style: SubtitleTrackStyle) {
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

export function wordStyle(style?: SubtitleWordStyle, karaokeColor?: string) {
  return {
    fontWeight: style?.bold === undefined ? undefined : style.bold ? 700 : 400,
    fontStyle: style?.italic === undefined ? undefined : style.italic ? "italic" : "normal",
    textDecoration: style?.underline === undefined ? undefined : style.underline ? "underline" : "none",
    color: karaokeColor ?? style?.text_color,
  } as const;
}

/**
 * The caption block layered over the video. Shared by the editor preview and the read-only share
 * view so the styling cascade (word override -> cue override -> project default) is applied in
 * exactly one place; a change to how captions render reaches both surfaces at once.
 */
export function CaptionOverlay({ cue, settings, translationStyle, mode, timeMs }: {
  cue?: SubtitleCue;
  settings: SubtitleSettings;
  translationStyle: SubtitleTrackStyle;
  mode: SubtitleExportMode;
  timeMs: number;
}) {
  if (!cue) return null;
  const originalStyle = cue.style_override ?? settings;
  const words = timedWordsForCue(cue);
  const original = settings.karaoke_enabled || words.some((word) => word.style)
    ? words.map((word, index) => <span key={`${word.start_ms}-${index}`} className="karaoke-word" style={wordStyle(word.style, settings.karaoke_enabled && timeMs >= word.start_ms && timeMs < word.end_ms ? settings.karaoke_color : undefined)}>{word.text}</span>)
    : cue.text;
  return <div className="live-caption">
    {mode !== "translated" && <span className="caption-line" style={captionStyle(originalStyle)}>{original}</span>}
    {mode === "bilingual" && cue.translated_text && <span className="caption-line translated-caption" style={captionStyle(translationStyle)}>{cue.translated_text}</span>}
    {mode === "translated" && <span className="caption-line" style={captionStyle(translationStyle)}>{cue.translated_text ?? cue.text}</span>}
  </div>;
}
