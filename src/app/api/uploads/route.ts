import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { BlobSASPermissions } from "@azure/storage-blob";
import { getRequestUser } from "@/lib/api-auth";
import { getVideoContainer } from "@/lib/azure";
import { createAdminSupabase } from "@/lib/supabase";
import { isTranslationLanguage } from "@/lib/subtitles";

const MAX_SIZE = 25 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { fileName?: string; fileSize?: number; contentType?: string; targetLanguage?: string | null };
  if (!body.fileName?.toLowerCase().endsWith(".mp4") || body.contentType !== "video/mp4") {
    return NextResponse.json({ error: "Select an MP4 video." }, { status: 400 });
  }
  if (!body.fileSize || body.fileSize > MAX_SIZE) {
    return NextResponse.json({ error: "Videos must be 25 MB or smaller for this MVP." }, { status: 400 });
  }
  if (body.targetLanguage && !isTranslationLanguage(body.targetLanguage)) {
    return NextResponse.json({ error: "Select a supported translation language." }, { status: 400 });
  }

  try {
    const container = getVideoContainer();
    await container.createIfNotExists();
    const blobName = `${user.id}/${randomUUID()}.mp4`;
    const blob = container.getBlockBlobClient(blobName);
    const uploadUrl = await blob.generateSasUrl({
      permissions: BlobSASPermissions.parse("cw"),
      expiresOn: new Date(Date.now() + 15 * 60 * 1000),
      contentType: "video/mp4",
    });
    const { data, error } = await createAdminSupabase().from("videos").insert({
      user_id: user.id,
      file_name: body.fileName,
      file_size: body.fileSize,
      blob_name: blobName,
      blob_url: blob.url,
      translation_target_language: body.targetLanguage || null,
      translation_status: body.targetLanguage ? "pending" : "none",
    }).select("id").single();
    if (error) throw error;
    return NextResponse.json({ videoId: data.id, uploadUrl });
  } catch (error) {
    console.error("Upload initialization failed", error);
    return NextResponse.json({ error: "Could not initialize upload." }, { status: 500 });
  }
}