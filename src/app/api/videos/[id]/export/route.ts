import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/api-auth";
import { createAdminSupabase } from "@/lib/supabase";
import { toSrt, toTxt, toVtt, type SubtitleCue } from "@/lib/subtitles";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const format = request.nextUrl.searchParams.get("format")?.toLowerCase();
  if (!format || !["srt", "vtt", "txt"].includes(format)) return NextResponse.json({ error: "Unsupported export format." }, { status: 400 });
  const { id } = await context.params;
  const db = createAdminSupabase();
  const { data: video } = await db.from("videos").select("file_name").eq("id", id).eq("user_id", user.id).single();
  if (!video) return NextResponse.json({ error: "Video not found." }, { status: 404 });
  const { data } = await db.from("subtitle_cues").select("cue_index, start_ms, end_ms, text").eq("video_id", id).order("cue_index");
  const cues = (data ?? []) as SubtitleCue[];
  const content = format === "srt" ? toSrt(cues) : format === "vtt" ? toVtt(cues) : toTxt(cues);
  const mime = format === "vtt" ? "text/vtt" : "text/plain";
  const baseName = video.file_name.replace(/\.mp4$/i, "").replace(/[^a-z0-9_-]+/gi, "-");
  return new NextResponse(content, { headers: {
    "Content-Type": `${mime}; charset=utf-8`,
    "Content-Disposition": `attachment; filename="${baseName}.${format}"`,
  }});
}