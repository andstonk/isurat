import { NextRequest, NextResponse } from "next/server";
import { BlobSASPermissions } from "@azure/storage-blob";
import { getRequestUser } from "@/lib/api-auth";
import { getFontReadUrl, getVideoContainer } from "@/lib/azure";
import { createAdminSupabase } from "@/lib/supabase";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const db = createAdminSupabase();
  const { data: video } = await db.from("videos").select("id, file_name, blob_name, status, language, duration_ms, transcript, translation_target_language, translation_status, subtitle_font_family, subtitle_font_source, subtitle_user_font_id, subtitle_text_color, subtitle_font_size, subtitle_bold, subtitle_italic, subtitle_underline, subtitle_strikethrough, subtitle_backdrop_color, subtitle_backdrop_opacity, subtitle_glow_enabled, subtitle_glow_color, subtitle_glow_blur, subtitle_glow_intensity, translation_font_family, translation_font_source, translation_user_font_id, translation_text_color, translation_font_size, translation_bold, translation_italic, translation_underline, translation_strikethrough, translation_backdrop_color, translation_backdrop_opacity, translation_glow_enabled, translation_glow_color, translation_glow_blur, translation_glow_intensity, words_per_cue, karaoke_enabled, karaoke_color, speaker_labels_enabled, speaker_label_style, speaker_label_color, sound_markers_enabled, sound_marker_color")
    .eq("id", id).eq("user_id", user.id).single();
  if (!video) return NextResponse.json({ error: "Video not found." }, { status: 404 });
  const { data: cues, error } = await db.from("subtitle_cues").select("id, cue_index, start_ms, end_ms, text, translated_text, words, style_override, speaker")
    .eq("video_id", id).order("cue_index");
  if (error) return NextResponse.json({ error: "Could not load subtitles." }, { status: 500 });
  const playbackUrl = await getVideoContainer().getBlockBlobClient(video.blob_name).generateSasUrl({
    permissions: BlobSASPermissions.parse("r"),
    expiresOn: new Date(Date.now() + 60 * 60 * 1000),
  });
  const fontIds = [...new Set([video.subtitle_user_font_id, video.translation_user_font_id].filter((fontId): fontId is string => Boolean(fontId)))];
  const customFonts: Record<string, { id: string; displayName: string; originalFileName: string; format: string; mimeType: string; fileSize: number; createdAt: string; url: string; archivedAt: string | null }> = {};
  if (fontIds.length) {
    const { data: fonts } = await db.from("user_fonts").select("id, display_name, original_file_name, blob_name, format, mime_type, file_size, created_at, archived_at")
      .eq("user_id", user.id).in("id", fontIds);
    await Promise.all((fonts ?? []).map(async (font) => {
      customFonts[font.id] = {
        id: font.id,
        displayName: font.display_name,
        originalFileName: font.original_file_name,
        format: font.format,
        mimeType: font.mime_type,
        fileSize: font.file_size,
        createdAt: font.created_at,
        url: await getFontReadUrl(font.blob_name),
        archivedAt: font.archived_at,
      };
    }));
  }
  return NextResponse.json({ video, cues, playbackUrl, customFonts });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const db = createAdminSupabase();
  const { data: video, error: videoError } = await db.from("videos").select("id, blob_name")
    .eq("id", id).eq("user_id", user.id).maybeSingle();
  if (videoError) return NextResponse.json({ error: "Could not load the video project." }, { status: 500 });
  if (!video) return NextResponse.json({ error: "Video not found." }, { status: 404 });

  try {
    await getVideoContainer().getBlockBlobClient(video.blob_name).deleteIfExists({ deleteSnapshots: "include" });
    const { data: deleted, error: deleteError } = await db.from("videos").delete()
      .eq("id", video.id).eq("user_id", user.id).select("id").maybeSingle();
    if (deleteError || !deleted) throw deleteError ?? new Error("Video project was not deleted.");
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Video deletion failed", error);
    return NextResponse.json({ error: "Could not delete the video project. Try again." }, { status: 500 });
  }
}