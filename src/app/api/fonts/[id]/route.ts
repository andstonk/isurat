import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/api-auth";
import { createAdminSupabase } from "@/lib/supabase";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const db = createAdminSupabase();
  const { data, error } = await db.from("user_fonts").update({
    archived_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("user_id", user.id).is("archived_at", null).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "Could not archive the font." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Font not found." }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
