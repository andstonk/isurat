import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/api-auth";
import { getFontBlob, getFontReadUrl, uploadFontBlob } from "@/lib/azure";
import {
  canonicalFontMimeType,
  detectFontFormat,
  fontHash,
  MAX_FONT_SIZE,
  MAX_USER_FONTS,
  sanitizeFileName,
  sanitizeFontName,
  validateFontMimeType,
} from "@/lib/font-validation";
import { createAdminSupabase } from "@/lib/supabase";

type FontRow = {
  id: string;
  display_name: string;
  original_file_name: string;
  blob_name: string;
  format: "woff2" | "woff" | "ttf" | "otf";
  mime_type: string;
  file_size: number;
  created_at: string;
  archived_at: string | null;
};

async function serializeFont(row: FontRow) {
  return {
    id: row.id,
    displayName: row.display_name,
    originalFileName: row.original_file_name,
    format: row.format,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
    url: await getFontReadUrl(row.blob_name),
  };
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = createAdminSupabase();
  const { data, error, count } = await db.from("user_fonts")
    .select("id, display_name, original_file_name, blob_name, format, mime_type, file_size, created_at, archived_at", { count: "exact" })
    .eq("user_id", user.id).is("archived_at", null).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Could not load your fonts." }, { status: 500 });
  try {
    const fonts = await Promise.all(((data ?? []) as FontRow[]).map(serializeFont));
    return NextResponse.json({ fonts, quota: { used: count ?? fonts.length, limit: MAX_USER_FONTS } });
  } catch (error) {
    console.error("Font URL generation failed", error);
    return NextResponse.json({ error: "Could not prepare your fonts." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Upload a valid font file." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Select a font file." }, { status: 400 });
  if (file.size > MAX_FONT_SIZE) return NextResponse.json({ error: "Fonts must be 5 MB or smaller." }, { status: 413 });
  if (form.get("rightsConfirmed") !== "true") {
    return NextResponse.json({ error: "Confirm that you have the right to use this font." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = detectFontFormat(bytes);
  if (!format || !validateFontMimeType(format, file.type || "application/octet-stream")) {
    return NextResponse.json({ error: "Upload a valid WOFF2, WOFF, TTF, or OTF font." }, { status: 415 });
  }

  const db = createAdminSupabase();
  const hash = fontHash(bytes);
  const [{ count }, { data: duplicate }] = await Promise.all([
    db.from("user_fonts").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("archived_at", null),
    db.from("user_fonts").select("id").eq("user_id", user.id).eq("file_hash", hash).maybeSingle(),
  ]);
  if (duplicate) return NextResponse.json({ error: "This font has already been uploaded." }, { status: 409 });
  if ((count ?? 0) >= MAX_USER_FONTS) return NextResponse.json({ error: `Your ${MAX_USER_FONTS}-font limit has been reached.` }, { status: 409 });

  const id = randomUUID();
  const blobName = `fonts/${user.id}/${id}.${format}`;
  const mimeType = canonicalFontMimeType(format);
  try {
    await uploadFontBlob(blobName, bytes, mimeType);
    const { data, error } = await db.from("user_fonts").insert({
      id,
      user_id: user.id,
      display_name: sanitizeFontName(String(form.get("displayName") ?? ""), file.name),
      original_file_name: sanitizeFileName(file.name),
      blob_name: blobName,
      format,
      mime_type: mimeType,
      file_size: bytes.byteLength,
      file_hash: hash,
      rights_confirmed_at: new Date().toISOString(),
    }).select("id, display_name, original_file_name, blob_name, format, mime_type, file_size, created_at, archived_at").single();
    if (error || !data) {
      await getFontBlob(blobName).deleteIfExists();
      if (error?.code === "23505") return NextResponse.json({ error: "This font has already been uploaded." }, { status: 409 });
      throw error ?? new Error("Font metadata was not created.");
    }
    return NextResponse.json({ font: await serializeFont(data as FontRow) }, { status: 201 });
  } catch (error) {
    console.error("Font upload failed", error);
    return NextResponse.json({ error: "Could not upload the font. Try again." }, { status: 500 });
  }
}
