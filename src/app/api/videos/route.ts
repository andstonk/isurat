import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/api-auth";
import { createAdminSupabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await createAdminSupabase().from("videos")
    .select("id, file_name, file_size, status, error_message, language, duration_ms, created_at, updated_at")
    .eq("user_id", user.id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Could not load videos." }, { status: 500 });
  return NextResponse.json({ videos: data });
}