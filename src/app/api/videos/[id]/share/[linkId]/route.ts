import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/api-auth";
import { canManageSharing, resolveProjectAccess } from "@/lib/collaboration";
import { createAdminSupabase } from "@/lib/supabase";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string; linkId: string }> }) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, linkId } = await context.params;
  const db = createAdminSupabase();
  const access = await resolveProjectAccess(db, id, user.id);
  if (!access) return NextResponse.json({ error: "Video not found." }, { status: 404 });
  if (!canManageSharing(access.role)) return NextResponse.json({ error: "Only the project owner can manage share links." }, { status: 403 });
  // Revoked rather than deleted, so the owner keeps the view count and can see the link existed.
  const { data: revoked, error } = await db.from("share_links").update({ revoked_at: new Date().toISOString() })
    .eq("id", linkId).eq("video_id", id).is("revoked_at", null).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "Could not revoke that share link." }, { status: 500 });
  if (!revoked) return NextResponse.json({ error: "Share link not found or already revoked." }, { status: 404 });
  return NextResponse.json({ revoked: true });
}
