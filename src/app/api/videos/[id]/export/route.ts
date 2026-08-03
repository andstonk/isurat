import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/api-auth";
import { createAdminSupabase } from "@/lib/supabase";
import { toSrt, toTxt, toVtt, type SubtitleCue, type SubtitleExportMode } from "@/lib/subtitles";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const format = request.nextUrl.searchParams.get("format")?.toLowerCase();
  if (!format || !["srt", "vtt", "txt"].includes(format)) return NextResponse.json({ error: "Unsupported export format." }, { status: 400 });
  const requestedMode = request.nextUrl.searchParams.get("mode") ?? "original";
  if (!["original", "translated", "bilingual"].includes(requestedMode)) return NextResponse.json({ error: "Unsupported subtitle export mode." }, { status: 400 });
  const mode = requestedMode as SubtitleExportMode;
  const { id } = await context.params;
  const db = createAdminSupabase();
  const { data: video } = await db.from("videos").select("file_name, language, translation_target_language").eq("id", id).eq("user_id", user.id).single();
  if (!video) return NextResponse.json({ error: "Video not found." }, { status: 404 });
  const { data } = await db.from("subtitle_cues").select("cue_index, start_ms, end_ms, text, translated_text").eq("video_id", id).order("cue_index");
  const cues = (data ?? []) as SubtitleCue[];
  const hasTranslationTrack = cues.some((cue) => cue.translated_text);
  if (mode !== "original" && !hasTranslationTrack) return NextResponse.json({ error: "This video has no translated subtitles." }, { status: 400 });
  const content = format === "srt" ? toSrt(cues, mode) : format === "vtt" ? toVtt(cues, mode) : toTxt(cues, mode);
  const mime = format === "vtt" ? "text/vtt" : "text/plain";
  const baseName = video.file_name.replace(/\.mp4$/i, "").replace(/[^a-z0-9_-]+/gi, "-");
  // Only suffix when a translation track exists — that's the only case where different modes would otherwise collide on one filename.
  const modeSuffix = hasTranslationTrack ? `.${mode === "bilingual" ? "bilingual" : mode === "translated" ? video.translation_target_language ?? "translated" : video.language ?? "original"}` : "";
  return new NextResponse(content, { headers: {
    "Content-Type": `${mime}; charset=utf-8`,
    "Content-Disposition": `attachment; filename="${baseName}${modeSuffix}.${format}"`,
  }});
}