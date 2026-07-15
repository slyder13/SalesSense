import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";

const EDITABLE = ["title", "phone", "location", "sales_role", "name"];

// POST { id, field, value } → rep edits a stakeholder card field
export async function POST(req: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

    const { id, field, value } = await req.json();
    if (!id || !EDITABLE.includes(field)) {
      return NextResponse.json({ error: "invalid field" }, { status: 400 });
    }

    const db = supabaseAdmin();
    const { error } = await db
      .from("attendee_profiles")
      .update({ [field]: value || null, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
