import { NextRequest, NextResponse } from "next/server";
import { currentAppUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabase";

// POST { botName, disclosureMessage, allowedDomains } → admin updates org settings
export async function POST(req: NextRequest) {
  try {
    const me = await currentAppUser();
    if (me?.role !== "admin") return NextResponse.json({ error: "admins only" }, { status: 403 });

    const { botName, disclosureMessage, allowedDomains } = await req.json();
    if (!botName?.trim() || !disclosureMessage?.trim() || !allowedDomains?.length) {
      return NextResponse.json({ error: "all fields are required" }, { status: 400 });
    }

    const db = supabaseAdmin();
    const { error } = await db
      .from("organizations")
      .update({
        bot_name: botName.trim(),
        disclosure_message: disclosureMessage.trim(),
        allowed_domains: allowedDomains,
      })
      .eq("id", me.orgId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
