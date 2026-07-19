import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";

// POST { insightId, payload } → rep adjusts debrief scores (kept in same insight row)
export async function POST(req: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

    const { insightId, payload } = await req.json();
    if (!insightId || !payload) return NextResponse.json({ error: "insightId and payload required" }, { status: 400 });

    const db = supabaseAdmin();
    const { error } = await db
      .from("insights")
      .update({ payload })
      .eq("id", insightId)
      .eq("kind", "debrief"); // only debrief rows are editable this way
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
