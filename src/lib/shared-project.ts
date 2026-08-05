import { BlobSASPermissions } from "@azure/storage-blob";
import { getFontReadUrl, getVideoContainer } from "@/lib/azure";
import { hashShareToken, shareLinkState } from "@/lib/collaboration";
import { createAdminSupabase } from "@/lib/supabase";
import { settingsFromVideoRow, translationStyleFromVideoRow, type SubtitleCue, type SubtitleSettings, type SubtitleTrackStyle } from "@/lib/subtitles";
import type { UserFont } from "@/lib/fonts";

export type SharedProject = {
  fileName: string;
  language: string | null;
  translationTargetLanguage: string | null;
  translationStatus: string | null;
  durationMs: number | null;
  playbackUrl: string;
  cues: SubtitleCue[];
  settings: SubtitleSettings;
  translationStyle: SubtitleTrackStyle;
  customFonts: Record<string, UserFont>;
  expiresAt: string | null;
};

export type SharedProjectResult =
  | { status: "ok"; project: SharedProject }
  | { status: "not-found" | "revoked" | "expired" };

/**
 * Resolves a share token to a read-only view of a project. Deliberately returns only what the
 * viewer needs to watch and read subtitles — no user id, blob name, error message, or transcript
 * column — because this is the one surface reachable without a signed-in session.
 */
export async function loadSharedProject(token: string): Promise<SharedProjectResult> {
  if (!token || token.length > 128) return { status: "not-found" };
  const db = createAdminSupabase();
  const { data: link } = await db.from("share_links")
    .select("id, video_id, expires_at, revoked_at, view_count")
    .eq("token_hash", hashShareToken(token)).maybeSingle();
  if (!link) return { status: "not-found" };
  const state = shareLinkState(link);
  if (state !== "active") return { status: state };

  const { data: video } = await db.from("videos")
    .select("id, file_name, blob_name, language, duration_ms, translation_target_language, translation_status, subtitle_font_family, subtitle_font_source, subtitle_user_font_id, subtitle_text_color, subtitle_font_size, subtitle_bold, subtitle_italic, subtitle_underline, subtitle_strikethrough, subtitle_backdrop_color, subtitle_backdrop_opacity, subtitle_glow_enabled, subtitle_glow_color, subtitle_glow_blur, subtitle_glow_intensity, translation_font_family, translation_font_source, translation_user_font_id, translation_text_color, translation_font_size, translation_bold, translation_italic, translation_underline, translation_strikethrough, translation_backdrop_color, translation_backdrop_opacity, translation_glow_enabled, translation_glow_color, translation_glow_blur, translation_glow_intensity, words_per_cue, karaoke_enabled, karaoke_color, speaker_labels_enabled, speaker_label_style, speaker_label_color, sound_markers_enabled, sound_marker_color")
    .eq("id", link.video_id).maybeSingle();
  if (!video) return { status: "not-found" };

  const { data: cues } = await db.from("subtitle_cues")
    .select("cue_index, start_ms, end_ms, text, translated_text, words, style_override, speaker")
    .eq("video_id", link.video_id).order("cue_index");

  const playbackUrl = await getVideoContainer().getBlockBlobClient(video.blob_name).generateSasUrl({
    permissions: BlobSASPermissions.parse("r"),
    expiresOn: new Date(Date.now() + 60 * 60 * 1000),
  });

  // Resolve every font the project references, including per-cue overrides, so a shared view
  // renders with the same typefaces the owner chose rather than falling back to a system font.
  const row = video as unknown as Record<string, unknown>;
  const fontIds = [...new Set([
    row.subtitle_user_font_id,
    row.translation_user_font_id,
    ...(cues ?? []).map((cue) => (cue.style_override as { user_font_id?: string } | null)?.user_font_id),
  ].filter((fontId): fontId is string => typeof fontId === "string"))];
  const customFonts: Record<string, UserFont> = {};
  if (fontIds.length) {
    const { data: fonts } = await db.from("user_fonts")
      .select("id, display_name, original_file_name, blob_name, format, mime_type, file_size, created_at, archived_at").in("id", fontIds);
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

  // Best-effort view accounting; a failure here must never block someone from viewing the page.
  await db.from("share_links").update({ view_count: (link.view_count ?? 0) + 1, last_viewed_at: new Date().toISOString() })
    .eq("id", link.id).then(undefined, (error: unknown) => console.warn("Could not record share link view", error));

  return {
    status: "ok",
    project: {
      fileName: video.file_name,
      language: video.language ?? null,
      translationTargetLanguage: video.translation_target_language ?? null,
      translationStatus: video.translation_status ?? null,
      durationMs: video.duration_ms ?? null,
      playbackUrl,
      cues: (cues ?? []) as SubtitleCue[],
      settings: settingsFromVideoRow(row),
      translationStyle: translationStyleFromVideoRow(row),
      customFonts,
      expiresAt: link.expires_at ?? null,
    },
  };
}
