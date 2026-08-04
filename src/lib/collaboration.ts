import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasValidWordTimings, isSubtitleTrackStyle, type SubtitleCue } from "@/lib/subtitles";

export type ProjectRole = "owner" | "editor" | "viewer";

/** Newest snapshots are kept; older ones are pruned so a project's jsonb history stays bounded. */
export const MAX_VERSIONS_PER_PROJECT = 20;

/**
 * Snapshots store the raw `videos` style columns rather than a mapped object, so a restore is a
 * verbatim column write-back with no second copy of the editor's normalization rules. Restores
 * filter the stored object through these allowlists, so an edited row can't write other columns.
 */
export const PROJECT_SETTINGS_COLUMNS = [
  "subtitle_font_family", "subtitle_font_source", "subtitle_user_font_id", "subtitle_text_color",
  "subtitle_font_size", "subtitle_bold", "subtitle_italic", "subtitle_underline", "subtitle_strikethrough",
  "subtitle_backdrop_color", "subtitle_backdrop_opacity", "subtitle_glow_enabled", "subtitle_glow_color",
  "subtitle_glow_blur", "subtitle_glow_intensity", "words_per_cue", "karaoke_enabled", "karaoke_color",
] as const;

export const TRANSLATION_STYLE_COLUMNS = [
  "translation_font_family", "translation_font_source", "translation_user_font_id", "translation_text_color",
  "translation_font_size", "translation_bold", "translation_italic", "translation_underline", "translation_strikethrough",
  "translation_backdrop_color", "translation_backdrop_opacity", "translation_glow_enabled", "translation_glow_color",
  "translation_glow_blur", "translation_glow_intensity",
] as const;

export const SNAPSHOT_CUE_COLUMNS = "cue_index, start_ms, end_ms, text, translated_text, words, style_override";

function pickColumns(row: Record<string, unknown>, columns: readonly string[]) {
  return Object.fromEntries(columns.filter((column) => column in row).map((column) => [column, row[column]]));
}

/**
 * Resolves what a signed-in user may do with a project. Ownership still comes from
 * `videos.user_id`; `project_members` is consulted for everyone else so the invite flow a later
 * phase adds needs no changes here. Returns null when the project doesn't exist or isn't visible.
 */
export async function resolveProjectAccess(db: SupabaseClient, videoId: string, userId: string, columns = "id, user_id") {
  const selection = columns.includes("user_id") ? columns : `${columns}, user_id`;
  const { data: video } = await db.from("videos").select(selection).eq("id", videoId).maybeSingle();
  if (!video) return null;
  const row = video as unknown as Record<string, unknown> & { user_id: string };
  if (row.user_id === userId) return { video: row, role: "owner" as ProjectRole };
  const { data: member } = await db.from("project_members").select("role").eq("video_id", videoId).eq("user_id", userId).maybeSingle();
  if (!member) return null;
  return { video: row, role: member.role as ProjectRole };
}

export function canEditProject(role: ProjectRole) {
  return role === "owner" || role === "editor";
}

/** Only owners manage share links — an editor can change subtitles but not who can see them. */
export function canManageSharing(role: ProjectRole) {
  return role === "owner";
}

export function createShareToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashShareToken(token) };
}

export function hashShareToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export type ShareLinkRow = { revoked_at: string | null; expires_at: string | null };

export function shareLinkState(link: ShareLinkRow): "active" | "revoked" | "expired" {
  if (link.revoked_at) return "revoked";
  if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) return "expired";
  return "active";
}

/**
 * Copies the project's currently *saved* state into a new snapshot, then prunes the oldest
 * snapshots past MAX_VERSIONS_PER_PROJECT. Reads from the database rather than accepting cues
 * from the client, so a snapshot always reflects something that was really persisted.
 */
export async function snapshotProject(db: SupabaseClient, videoId: string, params: { label: string; userId: string | null }) {
  const { data: video, error: videoError } = await db.from("videos")
    .select([...PROJECT_SETTINGS_COLUMNS, ...TRANSLATION_STYLE_COLUMNS].join(", "))
    .eq("id", videoId).single();
  if (videoError || !video) throw videoError ?? new Error("Project not found while creating a snapshot.");
  const { data: cues, error: cueError } = await db.from("subtitle_cues").select(SNAPSHOT_CUE_COLUMNS).eq("video_id", videoId).order("cue_index");
  if (cueError) throw cueError;

  const row = video as unknown as Record<string, unknown>;
  const { data: created, error: insertError } = await db.from("project_versions").insert({
    video_id: videoId,
    created_by: params.userId,
    label: params.label.trim().slice(0, 120) || "Untitled snapshot",
    cue_count: cues?.length ?? 0,
    cues: cues ?? [],
    settings: pickColumns(row, PROJECT_SETTINGS_COLUMNS),
    translation_style: pickColumns(row, TRANSLATION_STYLE_COLUMNS),
  }).select("id, label, created_at, cue_count").single();
  if (insertError) throw insertError;

  const { data: stale } = await db.from("project_versions").select("id")
    .eq("video_id", videoId).order("created_at", { ascending: false }).range(MAX_VERSIONS_PER_PROJECT, 1000);
  if (stale?.length) await db.from("project_versions").delete().in("id", stale.map((version) => version.id));
  return created;
}

/**
 * Snapshots are replayed into the same shape the save route writes, so a restored project is
 * indistinguishable from one that was edited by hand. Invalid cues are rejected rather than
 * partially applied — an old snapshot written before a schema change should fail loudly.
 */
export function isRestorableCue(value: unknown): value is SubtitleCue {
  if (!value || typeof value !== "object") return false;
  const cue = value as Record<string, unknown>;
  return typeof cue.start_ms === "number" && cue.start_ms >= 0
    && typeof cue.end_ms === "number" && cue.end_ms > cue.start_ms
    && typeof cue.text === "string" && cue.text.trim().length > 0
    && (cue.translated_text == null || typeof cue.translated_text === "string")
    && (cue.words == null || hasValidWordTimings(cue.words))
    && (cue.style_override == null || isSubtitleTrackStyle(cue.style_override));
}

export function restorableColumns(stored: unknown, columns: readonly string[]) {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
  return pickColumns(stored as Record<string, unknown>, columns);
}
