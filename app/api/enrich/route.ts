import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enrichInteraction } from "@/lib/pipeline";

export const maxDuration = 300;

// GET → returns the most recent stored meeting INCLUDING any insights and drafts
// the automatic pipeline already produced for it
export async function GET() {
  const db = supabaseAdmin();
  const { data } = await db
    .from("interactions")
    .select("id, title, occurred_at, created_at, transcript_segments(count)")
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "No meetings stored yet" }, { status: 404 });

  const { data: insights } = await db
    .from("insights")
    .select("kind, payload, created_at")
    .eq("interaction_id", data.id)
    .order("created_at", { ascending: false });

  const latest = (kind: string) => insights?.find((i) => i.kind === kind)?.payload;

  return NextResponse.json({
    interactionId: data.id,
    title: data.title,
    storedAt: data.created_at,
    segmentCount: (data as any).transcript_segments?.[0]?.count ?? 0,
    // Everything below is present only if the automatic pipeline already ran
    summary: latest("summary") ?? null,
    actionItems: insights?.filter((i) => i.kind === "action_item").map((i) => i.payload) ?? [],
    emailDraft: latest("email_draft") ?? null,
    crmNote: (latest("crm_note") as any)?.text ?? null,
  });
}

// POST { interactionId } → runs AI extraction over stored transcript, saves insights
export async function POST(req: NextRequest) {
  try {
    const { interactionId } = await req.json();
    if (!interactionId) return NextResponse.json({ error: "interactionId required" }, { status: 400 });

    const result = await enrichInteraction(interactionId);
    if (result.alreadyEnriched) {
      // Re-read stored insights so the UI can still display them
      const db = supabaseAdmin();
      const { data: insights } = await db
        .from("insights").select("kind, payload").eq("interaction_id", interactionId);
      return NextResponse.json({
        ok: true, dealId: result.dealId, alreadyEnriched: true,
        summary: insights?.find((i) => i.kind === "summary")?.payload,
        actionItems: insights?.filter((i) => i.kind === "action_item").map((i) => i.payload),
      });
    }
    return NextResponse.json({
      ok: true,
      dealId: result.dealId,
      summary: result.extracted.summary,
      actionItems: result.extracted.action_items,
      attendees: result.extracted.attendees,
      scoping: result.extracted.scoping,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
