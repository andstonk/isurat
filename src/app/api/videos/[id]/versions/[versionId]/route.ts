import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/api-auth";
import { canEditProject, resolveProjectAccess } from "@/lib/collaboration";
import { createAdminSupabase } from "@/lib/supabase";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string; versionId: string }> }) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, versionId } = await context.params;
  const db = createAdminSupabase();
  const access = await resolveProjectAccess(db, id, user.id);
  if (!access) return NextResponse.json({ error: "Video not found." }, { status: 404 });
  if (!canEditProject(access.role)) return NextResponse.json({ error: "You do not have permission to change this project's history." }, { status: 403 });
  // Scoped by video_id as well as id so a version id from another project can't be deleted.
  const { data: deleted, error } = await db.from("project_versions").delete()
    .eq("id", versionId).eq("video_id", id).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "Could not delete that snapshot." }, { status: 500 });
  if (!deleted) return NextResponse.json({ error: "Snapshot not found." }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
