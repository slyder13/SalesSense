import { NextRequest, NextResponse } from "next/server";
import { exchangeSfCode } from "@/lib/adapters/salesforce";
import { supabaseAdmin } from "@/lib/supabase";

const SQUARE9_ORG = "00000000-0000-0000-0000-000000000001";

// Salesforce redirects here after the user approves access
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get("sf_oauth_state")?.value;
  const verifier = req.cookies.get("sf_oauth_verifier")?.value;
  const userEmail = req.cookies.get("sf_oauth_email")?.value;

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/settings?sf_error=${encodeURIComponent(reason)}`, req.url));

  if (!code) return fail(req.nextUrl.searchParams.get("error_description") ?? "no code returned");
  if (!state || state !== cookieState) return fail("state mismatch — try again");
  if (!verifier) return fail("session expired — try again");

  try {
    const tokens = await exchangeSfCode(code, verifier);

    const db = supabaseAdmin();
    const { error } = await db.from("salesforce_connections").upsert(
      {
        org_id: SQUARE9_ORG,
        instance_url: tokens.instance_url,
        refresh_token: tokens.refresh_token,
        connected_by: userEmail,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "org_id" }
    );
    if (error) throw new Error(error.message);

    return NextResponse.redirect(new URL("/settings?sf_connected=1", req.url));
  } catch (e: any) {
    console.error(`Salesforce connect failed: ${e.message}`);
    return fail(e.message.slice(0, 120));
  }
}
