import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { syncCalendar } from "@/lib/autojoin";

export const maxDuration = 300;

// POST { recallEventId, override } → per-meeting record/skip toggle
export async function POST(req: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

    const { recallEventId, override } = await req.json();
    if (!recallEventId) return NextResponse.json({ error: "recallEventId required" }, { status: 400 });

    const db = supabaseAdmin();
    const { data: event, error } = await db
      .from("calendar_events")
      .update({ rep_override: override })
      .eq("recall_event_id", recallEventId)
      .select("recall_calendar_id")
      .single();
    if (error) throw new Error(error.message);

    // Re-run the rules so the bot gets scheduled/unscheduled immediately
    await syncCalendar(event.recall_calendar_id);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
