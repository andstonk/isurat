import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/api-auth";
import { isGoogleFontFamily } from "@/lib/google-fonts";
import { createAdminSupabase } from "@/lib/supabase";
import { hasValidWordTimings, isSubtitleTrackStyle, timedWordsForCue, type SubtitleCue, type SubtitleSettings, type SubtitleTrackStyle } from "@/lib/subtitles";
import { logError } from "@/lib/error-log";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const { cues, settings, translationStyle } = (await request.json()) as {
    cues?: SubtitleCue[];
    settings?: SubtitleSettings;
    translationStyle?: SubtitleTrackStyle;
  };
  if (!cues?.length || cues.some((cue, index) => cue.cue_index !== index || cue.start_ms < 0 || cue.end_ms <= cue.start_ms
    || !cue.text.trim() || (cue.translated_text != null && !cue.translated_text.trim()) || (cue.words != null && !hasValidWordTimings(cue.words))
    || (cue.style_override != null && !isSubtitleTrackStyle(cue.style_override)))) {
    return NextResponse.json({ error: "Subtitle cues are invalid." }, { status: 400 });
  }
  if (settings && (!isSubtitleTrackStyle(settings)
    || !Number.isInteger(settings.words_per_cue) || settings.words_per_cue < 2 || settings.words_per_cue > 16
    || typeof settings.karaoke_enabled !== "boolean" || typeof settings.karaoke_color !== "string"
    || !/^#[0-9a-f]{6}$/i.test(settings.karaoke_color))) {
    return NextResponse.json({ error: "Subtitle appearance settings are invalid." }, { status: 400 });
  }
  if (translationStyle && !isSubtitleTrackStyle(translationStyle)) {
    return NextResponse.json({ error: "Translation appearance settings are invalid." }, { status: 400 });
  }
  const db = createAdminSupabase();
  const { data: video } = await db.from("videos").select("id, subtitle_user_font_id, translation_user_font_id").eq("id", id).eq("user_id", user.id).single();
  if (!video) return NextResponse.json({ error: "Video not found." }, { status: 404 });
  const validateFontSelection = async (style: SubtitleTrackStyle, attachedFontId: string | null) => {
    if (style.font_source === "system") return true;
    if (style.font_source === "google") return isGoogleFontFamily(style.font_family);
    const { data: font } = await db.from("user_fonts").select("id, archived_at")
      .eq("id", style.user_font_id!).eq("user_id", user.id).maybeSingle();
    return Boolean(font && (!font.archived_at || font.id === attachedFontId));
  };
  try {
    if (settings && !await validateFontSelection(settings, video.subtitle_user_font_id)) {
      return NextResponse.json({ error: "The selected original subtitle font is unavailable." }, { status: 400 });
    }
    if (translationStyle && !await validateFontSelection(translationStyle, video.translation_user_font_id)) {
      return NextResponse.json({ error: "The selected translation font is unavailable." }, { status: 400 });
    }
    for (const cue of cues) {
      if (cue.style_override && !await validateFontSelection(cue.style_override, video.subtitle_user_font_id)) {
        return NextResponse.json({ error: `The font selected for subtitle ${cue.cue_index + 1} is unavailable.` }, { status: 400 });
      }
    }
  } catch (error) {
    console.error("Font selection validation failed", error);
    return NextResponse.json({ error: "Could not validate the selected font. Try again." }, { status: 503 });
  }
  await db.from("subtitle_cues").delete().eq("video_id", id);
  const { error } = await db.from("subtitle_cues").insert(cues.map((cue, index) => ({
    video_id: id, cue_index: index, start_ms: Math.round(cue.start_ms), end_ms: Math.round(cue.end_ms), text: cue.text.trim(),
    translated_text: cue.translated_text?.trim() || null,
    words: timedWordsForCue(cue),
    style_override: cue.style_override ?? null,
  })));
  if (error) {
    await logError(db, { route: "PUT /api/videos/[id]/subtitles", userId: user.id, videoId: id, error });
    return NextResponse.json({ error: "Could not save subtitles." }, { status: 500 });
  }
  const { error: videoError } = await db.from("videos").update({
    transcript: cues.map((cue) => cue.text.trim()).join(" "),
    ...(settings ? {
      subtitle_font_family: settings.font_family,
      subtitle_font_source: settings.font_source,
      subtitle_user_font_id: settings.user_font_id,
      subtitle_text_color: settings.text_color,
      subtitle_font_size: settings.font_size,
      subtitle_bold: settings.bold,
      subtitle_italic: settings.italic,
      subtitle_underline: settings.underline,
      subtitle_strikethrough: settings.strikethrough,
      subtitle_backdrop_color: settings.backdrop_color,
      subtitle_backdrop_opacity: settings.backdrop_opacity,
      subtitle_glow_enabled: settings.glow_enabled,
      subtitle_glow_color: settings.glow_color,
      subtitle_glow_blur: settings.glow_blur,
      subtitle_glow_intensity: settings.glow_intensity,
      words_per_cue: settings.words_per_cue,
      karaoke_enabled: settings.karaoke_enabled,
      karaoke_color: settings.karaoke_color,
    } : {}),
    ...(translationStyle ? {
      translation_font_family: translationStyle.font_family,
      translation_font_source: translationStyle.font_source,
      translation_user_font_id: translationStyle.user_font_id,
      translation_text_color: translationStyle.text_color,
      translation_font_size: translationStyle.font_size,
      translation_bold: translationStyle.bold,
      translation_italic: translationStyle.italic,
      translation_underline: translationStyle.underline,
      translation_strikethrough: translationStyle.strikethrough,
      translation_backdrop_color: translationStyle.backdrop_color,
      translation_backdrop_opacity: translationStyle.backdrop_opacity,
      translation_glow_enabled: translationStyle.glow_enabled,
      translation_glow_color: translationStyle.glow_color,
      translation_glow_blur: translationStyle.glow_blur,
      translation_glow_intensity: translationStyle.glow_intensity,
    } : {}),
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (videoError) {
    await logError(db, { route: "PUT /api/videos/[id]/subtitles", userId: user.id, videoId: id, error: videoError });
    return NextResponse.json({ error: "Subtitles were saved, but their appearance could not be saved." }, { status: 500 });
  }
  return NextResponse.json({ saved: true });
}