import { NextRequest, NextResponse } from "next/server";
import { draftInteraction } from "@/lib/pipeline";

export const maxDuration = 300;

// POST { interactionId, repName? } → generates follow-up email + CRM note from stored insights
export async function POST(req: NextRequest) {
  try {
    const { interactionId, repName = "Chris" } = await req.json();
    if (!interactionId) return NextResponse.json({ error: "interactionId required" }, { status: 400 });

    const drafts = await draftInteraction(interactionId, repName);
    return NextResponse.json({ ok: true, email: drafts.email, crmNote: drafts.crm_note });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
