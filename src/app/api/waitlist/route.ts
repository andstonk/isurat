import { NextRequest, NextResponse } from "next/server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }

  const email =
    typeof payload === "object" && payload !== null && "email" in payload
      ? String(payload.email).trim().toLowerCase()
      : "";

  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ message: "Please enter a valid email address." }, { status: 400 });
  }

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing Supabase server environment variables.");
    return NextResponse.json(
      { message: "The waitlist is being configured. Please try again soon." },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/waitlist`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ email, source: "landing-page" }),
      cache: "no-store",
    });

    if (response.ok) {
      return NextResponse.json(
        { message: "You’re on the list — welcome aboard!" },
        { status: 201 },
      );
    }

    const error = (await response.json().catch(() => null)) as { code?: string } | null;
    if (response.status === 409 || error?.code === "23505") {
      return NextResponse.json({ message: "You’re already on the waitlist!" });
    }

    console.error("Supabase waitlist insert failed", response.status, error?.code);
    return NextResponse.json(
      { message: "We couldn’t save your email. Please try again." },
      { status: 502 },
    );
  } catch (error) {
    console.error("Waitlist request failed", error);
    return NextResponse.json(
      { message: "We couldn’t connect. Please try again." },
      { status: 502 },
    );
  }
}
