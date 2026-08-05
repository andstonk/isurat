import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/api-auth";
import {
  canEditProject,
  isRestorableCue,
  PROJECT_SETTINGS_COLUMNS,
  resolveProjectAccess,
  restorableColumns,
  snapshotProject,
  TRANSLATION_STYLE_COLUMNS,
} from "@/lib/collaboration";
import { logError } from "@/lib/error-log";
import { createAdminSupabase } from "@/lib/supabase";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; versionId: string }> }) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, versionId } = await context.params;
  const db = createAdminSupabase();
  const access = await resolveProjectAccess(db, id, user.id);
  if (!access) return NextResponse.json({ error: "Video not found." }, { status: 404 });
  if (!canEditProject(access.role)) return NextResponse.json({ error: "You do not have permission to restore this project." }, { status: 403 });

  const { data: version } = await db.from("project_versions")
    .select("id, label, cues, settings, translation_style").eq("id", versionId).eq("video_id", id).maybeSingle();
  if (!version) return NextResponse.json({ error: "Snapshot not found." }, { status: 404 });

  const storedCues = Array.isArray(version.cues) ? version.cues : [];
  if (!storedCues.every(isRestorableCue)) {
    return NextResponse.json({ error: "This snapshot is not readable and cannot be restored." }, { status: 422 });
  }

  try {
    // Restoring is itself an edit, so capture the pre-restore state first. This is what makes
    // "restore the wrong version" recoverable in the UI instead of a database problem.
    await snapshotProject(db, id, { label: `Before restoring “${version.label}”`, userId: user.id });

    await db.from("subtitle_cues").delete().eq("video_id", id);
    if (storedCues.length) {
      const { error: insertError } = await db.from("subtitle_cues").insert(storedCues.map((cue, index) => ({
        video_id: id,
        cue_index: index,
        start_ms: Math.round(cue.start_ms),
        end_ms: Math.round(cue.end_ms),
        text: cue.text.trim(),
        translated_text: cue.translated_text?.trim() || null,
        words: cue.words ?? null,
        style_override: cue.style_override ?? null,
        speaker: cue.speaker?.trim() || null,
      })));
      if (insertError) throw insertError;
    }

    const { error: videoError } = await db.from("videos").update({
      ...restorableColumns(version.settings, PROJECT_SETTINGS_COLUMNS),
      ...restorableColumns(version.translation_style, TRANSLATION_STYLE_COLUMNS),
      transcript: storedCues.map((cue) => cue.text.trim()).join(" "),
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (videoError) throw videoError;

    return NextResponse.json({ restored: true, cueCount: storedCues.length, label: version.label });
  } catch (error) {
    await logError(db, { route: "POST /api/videos/[id]/versions/[versionId]/restore", userId: user.id, videoId: id, error });
    return NextResponse.json({ error: "Could not restore that snapshot." }, { status: 500 });
  }
}
