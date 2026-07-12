import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { generateDrafts, MODEL, DRAFTS_PROMPT_VERSION } from "@/lib/ai";

// POST { interactionId, repName? } → generates follow-up email + CRM note from stored insights
export async function POST(req: NextRequest) {
  try {
    const { interactionId, repName = "Chris" } = await req.json();
    if (!interactionId) return NextResponse.json({ error: "interactionId required" }, { status: 400 });

    const db = supabaseAdmin();

    // 1. Load this meeting's stored insights (extraction must run first)
    const { data: insights, error } = await db
      .from("insights")
      .select("kind, payload, deal_id, created_at")
      .eq("interaction_id", interactionId)
      .in("kind", ["summary", "action_item"])
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const summary = insights?.find((i) => i.kind === "summary");
    if (!summary) {
      return NextResponse.json(
        { error: "No insights found — run AI extraction on this meeting first" },
        { status: 400 }
      );
    }
    const actionItems = insights!.filter((i) => i.kind === "action_item").map((i) => i.payload);

    // 2. Scoping profile + attendee intel for the deal (adds context)
    const dealId = summary.deal_id;
    const [{ data: scoping }, { data: attendees }, { data: priorSummaries }] = await Promise.all([
      db.from("deal_scoping").select("field, value, unit, context").eq("deal_id", dealId).is("superseded_by", null),
      db.from("attendee_profiles").select("name, pain_points, interests").eq("deal_id", dealId),
      db.from("insights").select("payload, interaction_id, created_at")
        .eq("deal_id", dealId).eq("kind", "summary").neq("interaction_id", interactionId)
        .order("created_at", { ascending: false }).limit(3),
    ]);

    // 3. Generate
    const drafts = await generateDrafts({
      repName,
      extracted: { summary: summary.payload, action_items: actionItems, scoping, attendees },
      priorMeetings: priorSummaries?.map((p) => p.payload),
    });

    // 4. Store as insights (same table, new kinds — no schema change)
    const meta = {
      interaction_id: interactionId, deal_id: dealId,
      prompt_version: DRAFTS_PROMPT_VERSION, model: MODEL,
    };
    const { error: insErr } = await db.from("insights").insert([
      { ...meta, kind: "email_draft", payload: drafts.email },
      { ...meta, kind: "crm_note", payload: { text: drafts.crm_note } },
    ]);
    if (insErr) throw new Error(insErr.message);

    return NextResponse.json({ ok: true, email: drafts.email, crmNote: drafts.crm_note });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
