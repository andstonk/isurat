import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/api-auth";
import { canManageSharing, createShareToken, resolveProjectAccess, shareLinkState } from "@/lib/collaboration";
import { logError } from "@/lib/error-log";
import { createAdminSupabase } from "@/lib/supabase";

const LINK_COLUMNS = "id, created_at, expires_at, revoked_at, last_viewed_at, view_count";
const MAX_EXPIRY_DAYS = 365;

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const db = createAdminSupabase();
  const access = await resolveProjectAccess(db, id, user.id);
  if (!access) return NextResponse.json({ error: "Video not found." }, { status: 404 });
  if (!canManageSharing(access.role)) return NextResponse.json({ error: "Only the project owner can manage share links." }, { status: 403 });
  const { data: links, error } = await db.from("share_links").select(LINK_COLUMNS).eq("video_id", id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Could not load share links." }, { status: 500 });
  // The raw token is never stored, so an existing link's URL cannot be shown again after creation.
  return NextResponse.json({ links: (links ?? []).map((link) => ({ ...link, state: shareLinkState(link) })) });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const { expiresInDays } = (await request.json().catch(() => ({}))) as { expiresInDays?: number | null };
  if (expiresInDays != null && (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > MAX_EXPIRY_DAYS)) {
    return NextResponse.json({ error: `Expiry must be between 1 and ${MAX_EXPIRY_DAYS} days, or left empty for no expiry.` }, { status: 400 });
  }
  const db = createAdminSupabase();
  const access = await resolveProjectAccess(db, id, user.id);
  if (!access) return NextResponse.json({ error: "Video not found." }, { status: 404 });
  if (!canManageSharing(access.role)) return NextResponse.json({ error: "Only the project owner can manage share links." }, { status: 403 });

  const { token, tokenHash } = createShareToken();
  const { data: link, error } = await db.from("share_links").insert({
    video_id: id,
    created_by: user.id,
    token_hash: tokenHash,
    expires_at: expiresInDays == null ? null : new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString(),
  }).select(LINK_COLUMNS).single();
  if (error || !link) {
    await logError(db, { route: "POST /api/videos/[id]/share", userId: user.id, videoId: id, error: error ?? new Error("Share link was not created.") });
    return NextResponse.json({ error: "Could not create a share link." }, { status: 500 });
  }
  // Returned exactly once — after this response the token exists only in the recipient's URL.
  return NextResponse.json({ link: { ...link, state: shareLinkState(link) }, token, path: `/share/${token}` }, { status: 201 });
}
