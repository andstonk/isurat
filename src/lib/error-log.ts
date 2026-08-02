import type { SupabaseClient } from "@supabase/supabase-js";

export async function logError(db: SupabaseClient, params: {
  route: string;
  userId?: string | null;
  videoId?: string | null;
  error: unknown;
  metadata?: Record<string, unknown>;
}) {
  const { route, userId, videoId, error, metadata } = params;
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  try {
    const { error: insertError } = await db.from("error_logs").insert({
      route,
      user_id: userId ?? null,
      video_id: videoId ?? null,
      message: message.slice(0, 2000),
      stack: stack?.slice(0, 4000),
      metadata: metadata ?? null,
    });
    if (insertError) console.warn("Failed to write error_logs entry", insertError);
  } catch (loggingError) {
    console.warn("Failed to write error_logs entry", loggingError);
  }
}
