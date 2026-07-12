import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { extractMeetingIntelligence, MODEL, PROMPT_VERSION } from "@/lib/ai";

// GET → returns the most recent stored meeting (so the test page survives a refresh)
export async function GET() {
  const db = supabaseAdmin();
  const { data } = await db
    .from("interactions")
    .select("id, title, occurred_at, transcript_segments(count)")
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "No meetings stored yet" }, { status: 404 });
  return NextResponse.json({
    interactionId: data.id,
    title: data.title,
    segmentCount: (data as any).transcript_segments?.[0]?.count ?? 0,
  });
}

// POST { interactionId } → runs AI extraction over stored transcript, saves insights
export async function POST(req: NextRequest) {
  try {
    const { interactionId } = await req.json();
    if (!interactionId) return NextResponse.json({ error: "interactionId required" }, { status: 400 });

    const db = supabaseAdmin();

    // 1. Load transcript segments
    const { data: segments, error: segErr } = await db
      .from("transcript_segments")
      .select("id, speaker_label, text")
      .eq("interaction_id", interactionId)
      .order("start_ms");
    if (segErr) throw new Error(segErr.message);
    if (!segments?.length) return NextResponse.json({ error: "No transcript found" }, { status: 404 });

    // 2. Ensure the interaction has a deal (scoping + attendee profiles are deal-level)
    const { data: interaction } = await db
      .from("interactions").select("id, deal_id").eq("id", interactionId).single();
    let dealId = interaction?.deal_id;
    if (!dealId) {
      const { data: deal, error: dErr } = await db
        .from("deals").insert({ name: "Test Deal" }).select("id").single();
      if (dErr) throw new Error(dErr.message);
      dealId = deal.id;
      await db.from("interactions").update({ deal_id: dealId }).eq("id", interactionId);
    }

    // 3. Run extraction (segment numbers keep the prompt small; map back to UUIDs after)
    const numbered = segments.map((s, i) => ({ idx: i, speaker: s.speaker_label ?? "?", text: s.text }));
    const extracted = await extractMeetingIntelligence(numbered);
    const toIds = (refs?: number[]) =>
      (refs ?? []).map((r) => segments[r]?.id).filter(Boolean);

    const meta = { interaction_id: interactionId, deal_id: dealId, prompt_version: PROMPT_VERSION, model: MODEL };

    // 4. Store summary
    const inserts: any[] = [
      { ...meta, kind: "summary", payload: extracted.summary, segment_ids: toIds(extracted.summary?.topics?.flatMap((t: any) => t.segment_refs)) },
      ...(extracted.action_items ?? []).map((a: any) => ({
        ...meta, kind: "action_item", payload: a, segment_ids: toIds(a.segment_refs),
      })),
    ];
    const { error: insErr } = await db.from("insights").insert(inserts);
    if (insErr) throw new Error(insErr.message);

    // 5. Store scoping items (append-only living profile; flag changes)
    for (const s of extracted.scoping ?? []) {
      const { data: prev } = await db
        .from("deal_scoping").select("id, value").eq("deal_id", dealId).eq("field", s.field)
        .is("superseded_by", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const { data: row, error } = await db.from("deal_scoping").insert({
        deal_id: dealId, field: s.field, value: String(s.value), unit: s.unit,
        context: s.context, interaction_id: interactionId, segment_ids: toIds(s.segment_refs),
      }).select("id").single();
      if (error) throw new Error(error.message);
      if (prev && prev.value !== String(s.value)) {
        await db.from("deal_scoping").update({ superseded_by: row.id }).eq("id", prev.id);
      }
    }

    // 6. Upsert attendee profiles (accumulate across meetings)
    for (const a of extracted.attendees ?? []) {
      if (a.side !== "external") continue;
      const key = { deal_id: dealId, email: a.name.toLowerCase().replace(/\s+/g, ".") + "@unknown" };
      const tag = (items: any[]) =>
        (items ?? []).map((i: any) => ({ ...i, interaction_id: interactionId, segment_ids: toIds(i.segment_refs) }));
      const { data: existing } = await db
        .from("attendee_profiles").select("*").eq("deal_id", dealId).eq("email", key.email).maybeSingle();
      if (existing) {
        await db.from("attendee_profiles").update({
          pain_points: [...existing.pain_points, ...tag(a.pain_points)],
          interests: [...existing.interests, ...tag(a.interests)],
          rapport_notes: [...existing.rapport_notes, ...tag(a.rapport_notes)],
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
      } else {
        await db.from("attendee_profiles").insert({
          ...key, name: a.name,
          pain_points: tag(a.pain_points), interests: tag(a.interests), rapport_notes: tag(a.rapport_notes),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      dealId,
      summary: extracted.summary,
      actionItems: extracted.action_items,
      attendees: extracted.attendees,
      scoping: extracted.scoping,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
