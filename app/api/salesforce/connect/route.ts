import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { sfAuthUrl, pkcePair } from "@/lib/adapters/salesforce";
import crypto from "crypto";

// GET → kicks off the Salesforce OAuth flow
export async function GET(request: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const state = crypto.randomBytes(16).toString("hex");
  const { verifier, challenge } = pkcePair();

  const response = NextResponse.redirect(sfAuthUrl(state, challenge));
  response.cookies.set("sf_oauth_state", state, { httpOnly: true, maxAge: 600, path: "/" });
  response.cookies.set("sf_oauth_verifier", verifier, { httpOnly: true, maxAge: 600, path: "/" });
  response.cookies.set("sf_oauth_email", user.email!, { httpOnly: true, maxAge: 600, path: "/" });
  return response;
}
