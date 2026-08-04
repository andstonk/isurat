import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/api-auth";
import { canEditProject, resolveProjectAccess, snapshotProject } from "@/lib/collaboration";
import { logError } from "@/lib/error-log";
import { createAdminSupabase } from "@/lib/supabase";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const db = createAdminSupabase();
  const access = await resolveProjectAccess(db, id, user.id);
  if (!access) return NextResponse.json({ error: "Video not found." }, { status: 404 });
  const { data: versions, error } = await db.from("project_versions")
    .select("id, label, created_at, cue_count").eq("video_id", id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Could not load version history." }, { status: 500 });
  return NextResponse.json({ versions, role: access.role, canEdit: canEditProject(access.role) });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const { label } = (await request.json().catch(() => ({}))) as { label?: string };
  const db = createAdminSupabase();
  const access = await resolveProjectAccess(db, id, user.id);
  if (!access) return NextResponse.json({ error: "Video not found." }, { status: 404 });
  if (!canEditProject(access.role)) return NextResponse.json({ error: "You do not have permission to snapshot this project." }, { status: 403 });
  try {
    const version = await snapshotProject(db, id, {
      label: label?.trim() || `Snapshot ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`,
      userId: user.id,
    });
    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    await logError(db, { route: "POST /api/videos/[id]/versions", userId: user.id, videoId: id, error });
    return NextResponse.json({ error: "Could not save a snapshot." }, { status: 500 });
  }
}
