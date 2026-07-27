import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/api-auth";
import { createAdminSupabase } from "@/lib/supabase";
import type { SubtitleCue } from "@/lib/subtitles";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const { cues } = (await request.json()) as { cues?: SubtitleCue[] };
  if (!cues?.length || cues.some((cue, index) => cue.cue_index !== index || cue.start_ms < 0 || cue.end_ms <= cue.start_ms || !cue.text.trim())) {
    return NextResponse.json({ error: "Subtitle cues are invalid." }, { status: 400 });
  }
  const db = createAdminSupabase();
  const { data: video } = await db.from("videos").select("id").eq("id", id).eq("user_id", user.id).single();
  if (!video) return NextResponse.json({ error: "Video not found." }, { status: 404 });
  await db.from("subtitle_cues").delete().eq("video_id", id);
  const { error } = await db.from("subtitle_cues").insert(cues.map((cue, index) => ({
    video_id: id, cue_index: index, start_ms: Math.round(cue.start_ms), end_ms: Math.round(cue.end_ms), text: cue.text.trim(),
  })));
  if (error) return NextResponse.json({ error: "Could not save subtitles." }, { status: 500 });
  await db.from("videos").update({ transcript: cues.map((cue) => cue.text.trim()).join(" "), updated_at: new Date().toISOString() }).eq("id", id);
  return NextResponse.json({ saved: true });
}