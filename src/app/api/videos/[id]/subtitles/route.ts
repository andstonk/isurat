import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/api-auth";
import { createAdminSupabase } from "@/lib/supabase";
import { isSubtitleFont, type SubtitleCue, type SubtitleSettings } from "@/lib/subtitles";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const { cues, settings } = (await request.json()) as { cues?: SubtitleCue[]; settings?: SubtitleSettings };
  if (!cues?.length || cues.some((cue, index) => cue.cue_index !== index || cue.start_ms < 0 || cue.end_ms <= cue.start_ms
    || !cue.text.trim() || (cue.translated_text != null && !cue.translated_text.trim()))) {
    return NextResponse.json({ error: "Subtitle cues are invalid." }, { status: 400 });
  }
  if (settings && (!isSubtitleFont(settings.font_family)
    || !/^#[0-9a-f]{6}$/i.test(settings.text_color)
    || !Number.isInteger(settings.font_size) || settings.font_size < 12 || settings.font_size > 64
    || typeof settings.bold !== "boolean" || typeof settings.italic !== "boolean"
    || typeof settings.underline !== "boolean" || typeof settings.strikethrough !== "boolean"
    || !/^#[0-9a-f]{6}$/i.test(settings.backdrop_color)
    || !Number.isInteger(settings.backdrop_opacity) || settings.backdrop_opacity < 0 || settings.backdrop_opacity > 100
    || !Number.isInteger(settings.words_per_cue) || settings.words_per_cue < 2 || settings.words_per_cue > 16)) {
    return NextResponse.json({ error: "Subtitle appearance settings are invalid." }, { status: 400 });
  }
  const db = createAdminSupabase();
  const { data: video } = await db.from("videos").select("id").eq("id", id).eq("user_id", user.id).single();
  if (!video) return NextResponse.json({ error: "Video not found." }, { status: 404 });
  await db.from("subtitle_cues").delete().eq("video_id", id);
  const { error } = await db.from("subtitle_cues").insert(cues.map((cue, index) => ({
    video_id: id, cue_index: index, start_ms: Math.round(cue.start_ms), end_ms: Math.round(cue.end_ms), text: cue.text.trim(),
    translated_text: cue.translated_text?.trim() || null,
  })));
  if (error) return NextResponse.json({ error: "Could not save subtitles." }, { status: 500 });
  const { error: videoError } = await db.from("videos").update({
    transcript: cues.map((cue) => cue.text.trim()).join(" "),
    ...(settings ? {
      subtitle_font_family: settings.font_family,
      subtitle_text_color: settings.text_color,
      subtitle_font_size: settings.font_size,
      subtitle_bold: settings.bold,
      subtitle_italic: settings.italic,
      subtitle_underline: settings.underline,
      subtitle_strikethrough: settings.strikethrough,
      subtitle_backdrop_color: settings.backdrop_color,
      subtitle_backdrop_opacity: settings.backdrop_opacity,
      words_per_cue: settings.words_per_cue,
    } : {}),
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (videoError) return NextResponse.json({ error: "Subtitles were saved, but their appearance could not be saved." }, { status: 500 });
  return NextResponse.json({ saved: true });
}