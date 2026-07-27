import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/api-auth";
import { createAdminSupabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { videoId } = (await request.json()) as { videoId?: string };
  if (!videoId) return NextResponse.json({ error: "Video ID is required." }, { status: 400 });

  const { data, error } = await createAdminSupabase().from("videos")
    .update({ status: "queued", updated_at: new Date().toISOString() })
    .eq("id", videoId).eq("user_id", user.id).eq("status", "uploading")
    .select("id, status").single();
  if (error || !data) return NextResponse.json({ error: "Could not create processing job." }, { status: 400 });
  return NextResponse.json(data);
}