import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/api-auth";
import { getGoogleFonts } from "@/lib/google-fonts";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ fonts: await getGoogleFonts() });
  } catch (error) {
    console.error("Google Fonts catalog failed", error);
    return NextResponse.json({ error: "Google Fonts is currently unavailable." }, { status: 503 });
  }
}
