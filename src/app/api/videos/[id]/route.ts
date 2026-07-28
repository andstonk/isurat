import { NextRequest, NextResponse } from "next/server";
import { BlobSASPermissions } from "@azure/storage-blob";
import { getRequestUser } from "@/lib/api-auth";
import { getVideoContainer } from "@/lib/azure";
import { createAdminSupabase } from "@/lib/supabase";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const db = createAdminSupabase();
  const { data: video } = await db.from("videos").select("id, file_name, blob_name, status, language, duration_ms, transcript")
    .eq("id", id).eq("user_id", user.id).single();
  if (!video) return NextResponse.json({ error: "Video not found." }, { status: 404 });
  const { data: cues, error } = await db.from("subtitle_cues").select("id, cue_index, start_ms, end_ms, text")
    .eq("video_id", id).order("cue_index");
  if (error) return NextResponse.json({ error: "Could not load subtitles." }, { status: 500 });
  const playbackUrl = await getVideoContainer().getBlockBlobClient(video.blob_name).generateSasUrl({
    permissions: BlobSASPermissions.parse("r"),
    expiresOn: new Date(Date.now() + 60 * 60 * 1000),
  });
  return NextResponse.json({ video, cues, playbackUrl });
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