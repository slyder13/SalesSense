import { NextRequest, NextResponse } from "next/server";
import { exchangeGoogleCode, createRecallCalendar } from "@/lib/adapters/calendar";
import { supabaseAdmin } from "@/lib/supabase";

// Google redirects here after the user approves calendar access
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get("cal_oauth_state")?.value;
  const userEmail = req.cookies.get("cal_oauth_email")?.value;

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/settings?calendar_error=${encodeURIComponent(reason)}`, req.url));

  if (!code) return fail(req.nextUrl.searchParams.get("error") ?? "no code returned");
  if (!state || state !== cookieState) return fail("state mismatch — try connecting again");
  if (!userEmail) return fail("session expired — try connecting again");

  try {
    const tokens = await exchangeGoogleCode(code);
    if (!tokens.refresh_token) {
      return fail("Google didn't return a refresh token — try again (it should prompt for consent)");
    }

    const calendar = await createRecallCalendar(tokens.refresh_token);

    const db = supabaseAdmin();
    const { error } = await db
      .from("users")
      .update({
        recall_calendar_id: calendar.id,
        calendar_email: userEmail,
        calendar_connected_at_v2: new Date().toISOString(),
      })
      .eq("email", userEmail);
    if (error) throw new Error(error.message);

    return NextResponse.redirect(new URL("/settings?calendar_connected=1", req.url));
  } catch (e: any) {
    console.error(`Calendar connect failed: ${e.message}`);
    return fail(e.message.slice(0, 120));
  }
}
