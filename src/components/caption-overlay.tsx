"use client";

import { Fragment, type ReactNode } from "react";
import { resolvedFontFamily } from "@/lib/font-loader";
import { formatSpeakerLabel, hasAccessibilityMarker, markedWordsForCue, splitCaptionSegments, type SubtitleCue, type SubtitleExportMode, type SubtitleSettings, type SubtitleTrackStyle, type SubtitleWordStyle } from "@/lib/subtitles";

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

/** Tints `[door slams]`-style runs so a viewer can tell non-speech audio from dialogue at a glance. */
function markerText(text: string, color: string): ReactNode {
  if (!hasAccessibilityMarker(text)) return text;
  return splitCaptionSegments(text).map((segment, index) => segment.marker
    ? <span key={index} className="caption-marker" style={{ color }}>{segment.text}</span>
    : <Fragment key={index}>{segment.text}</Fragment>);
}

/**
 * The caption block layered over the video. Shared by the editor preview and the read-only share
 * view so the styling cascade (word override -> cue override -> project default) is applied in
 * exactly one place; a change to how captions render reaches both surfaces at once.
 *
 * Speaker labels and accessibility markers are rendering concerns only — this component displays
 * `cue.speaker` when the project asks for it and never decides who is speaking.
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
  const words = markedWordsForCue(cue);
  const markers = settings.sound_markers_enabled;
  const original = settings.karaoke_enabled || words.some((word) => word.style)
    ? words.map((word, index) => <span key={`${word.start_ms}-${index}`} className={`karaoke-word${markers && word.marker ? " caption-marker" : ""}`}
      // A marker is not spoken, so it never takes the karaoke highlight — it keeps the marker tint instead.
      style={markers && word.marker ? { color: settings.sound_marker_color } : wordStyle(word.style, settings.karaoke_enabled && timeMs >= word.start_ms && timeMs < word.end_ms ? settings.karaoke_color : undefined)}>{word.text}</span>)
    : markers ? markerText(cue.text, settings.sound_marker_color) : cue.text;
  const speakerLabel = settings.speaker_labels_enabled && cue.speaker?.trim() ? formatSpeakerLabel(cue.speaker, settings.speaker_label_style) : "";
  // Bilingual repeats the same line in two languages, so the label belongs to the block, not to
  // each track — show it once, on whichever line is the first one visible in this mode.
  const speaker = speakerLabel ? <span className="caption-speaker" style={{ color: settings.speaker_label_color }}>{speakerLabel} </span> : null;
  const translated = markers ? markerText(cue.translated_text ?? cue.text, settings.sound_marker_color) : cue.translated_text ?? cue.text;
  return <div className="live-caption">
    {mode !== "translated" && <span className="caption-line" style={captionStyle(originalStyle)}>{speaker}{original}</span>}
    {mode === "bilingual" && cue.translated_text && <span className="caption-line translated-caption" style={captionStyle(translationStyle)}>{markers ? markerText(cue.translated_text, settings.sound_marker_color) : cue.translated_text}</span>}
    {mode === "translated" && <span className="caption-line" style={captionStyle(translationStyle)}>{speaker}{translated}</span>}
  </div>;
}
