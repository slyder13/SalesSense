import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { googleAuthUrl } from "@/lib/adapters/calendar";
import crypto from "crypto";

// GET → kicks off the Google OAuth flow for the signed-in user
export async function GET(request: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const state = crypto.randomBytes(16).toString("hex");
  const response = NextResponse.redirect(googleAuthUrl(state));
  // Short-lived cookies tie the callback to this browser + user
  response.cookies.set("cal_oauth_state", state, { httpOnly: true, maxAge: 600, path: "/" });
  response.cookies.set("cal_oauth_email", user.email!, { httpOnly: true, maxAge: 600, path: "/" });
  return response;
}
