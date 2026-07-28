import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/api-auth";
import { getVideoContainer } from "@/lib/azure";
import {
  createSonioxTranscription,
  deleteSonioxFile,
  deleteSonioxTranscription,
  detectTranscriptLanguage,
  getSonioxTranscript,
  tokensToBilingualCues,
  tokensToSubtitleCues,
  uploadSonioxFile,
  waitForSonioxTranscription,
} from "@/lib/soniox";
import { createAdminSupabase } from "@/lib/supabase";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { videoId } = (await request.json()) as { videoId?: string };
  const db = createAdminSupabase();
  const { data: video } = await db.from("videos").select("*").eq("id", videoId).eq("user_id", user.id).single();
  if (!video || !["queued", "failed"].includes(video.status)) {
    return NextResponse.json({ error: "Processing job was not found." }, { status: 404 });
  }

  await db.from("videos").update({ status: "processing", error_message: null, updated_at: new Date().toISOString() }).eq("id", video.id);
  let sonioxFileId: string | undefined;
  let sonioxTranscriptionId: string | undefined;
  try {
    const buffer = await getVideoContainer().getBlockBlobClient(video.blob_name).downloadToBuffer();
    const sonioxFile = await uploadSonioxFile(buffer, video.file_name);
    sonioxFileId = sonioxFile.id;
    const transcription = await createSonioxTranscription(sonioxFile.id, video.id, video.translation_target_language);
    sonioxTranscriptionId = transcription.id;
    const completed = await waitForSonioxTranscription(transcription.id);
    const result = await getSonioxTranscript(transcription.id);
    const bilingualCues = video.translation_target_language ? tokensToBilingualCues(result.tokens) : [];
    if (video.translation_target_language && !bilingualCues.length) {
      throw new Error("Soniox did not return translated subtitle tokens for the selected language.");
    }
    const generatedCues = bilingualCues.length ? bilingualCues : tokensToSubtitleCues(result.tokens);
    if (!generatedCues.length) throw new Error("Soniox did not return timestamped speech tokens.");
    const cues = generatedCues.map((cue) => ({ ...cue, video_id: video.id }));
    await db.from("subtitle_cues").delete().eq("video_id", video.id);
    const { error: cueError } = await db.from("subtitle_cues").insert(cues);
    if (cueError) throw cueError;
    await db.from("videos").update({
      status: "ready",
      transcript: cues.map((cue) => cue.text).join(" "),
      language: detectTranscriptLanguage(result.tokens),
      translation_status: video.translation_target_language && bilingualCues.length ? "ready" : "none",
      duration_ms: completed.audio_duration_ms ?? cues.at(-1)?.end_ms,
      updated_at: new Date().toISOString(),
    }).eq("id", video.id);
    return NextResponse.json({ id: video.id, status: "ready" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown processing error";
    console.error("Transcription failed", error);
    await db.from("videos").update({
      status: "failed",
      translation_status: video.translation_target_language ? "failed" : "none",
      error_message: message.slice(0, 500),
      updated_at: new Date().toISOString(),
    }).eq("id", video.id);
    return NextResponse.json({ error: "Transcription failed. Check the server configuration and try again." }, { status: 500 });
  } finally {
    if (sonioxTranscriptionId) {
      await deleteSonioxTranscription(sonioxTranscriptionId).catch((error) => console.warn("Soniox cleanup failed", error));
    } else if (sonioxFileId) {
      await deleteSonioxFile(sonioxFileId).catch((error) => console.warn("Soniox file cleanup failed", error));
    }
  }
}