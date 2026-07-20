import { NextRequest, NextResponse } from "next/server";
import { currentAppUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabase";

// POST { insightId, rating, comment? } → thumbs up/down on an AI output.
// One feedback per user per insight (re-clicking updates it).
export async function POST(req: NextRequest) {
  try {
    const user = await currentAppUser();
    if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

    const { insightId, rating, comment } = await req.json();
    if (!insightId || !["up", "down"].includes(rating)) {
      return NextResponse.json({ error: "invalid feedback" }, { status: 400 });
    }

    const db = supabaseAdmin();
    const { data: existing } = await db
      .from("feedback").select("id").eq("insight_id", insightId).eq("user_id", user.id).maybeSingle();

    if (existing) {
      await db.from("feedback").update({ rating, comment: comment ?? null }).eq("id", existing.id);
    } else {
      await db.from("feedback").insert({ insight_id: insightId, user_id: user.id, rating, comment: comment ?? null });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
