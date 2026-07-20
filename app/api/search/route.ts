import { NextRequest, NextResponse } from "next/server";
import { currentAppUser, canSeeAllMeetings } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabase";
import { embedQuery } from "@/lib/ai";

// GET ?q=term → hybrid search (semantic + keyword) across transcripts
export async function GET(req: NextRequest) {
  try {
    const user = await currentAppUser();
    if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length < 2) return NextResponse.json({ results: [] });

    const db = supabaseAdmin();

    // Semantic search via embeddings
    const queryVec = await embedQuery(q);
    const { data: semantic } = await db.rpc("search_transcripts", {
      query_embedding: queryVec,
      match_count: 20,
    });

    // Keyword fallback (catches exact terms embeddings might miss)
    const { data: keyword } = await db
      .from("transcript_segments")
      .select("interaction_id, text")
      .ilike("text", `%${q.replace(/[%_]/g, "")}%`)
      .limit(20);

    // Merge by interaction, keep best snippet per meeting
    const byInteraction = new Map<string, { snippet: string; score: number }>();
    for (const r of semantic ?? []) {
      const existing = byInteraction.get(r.interaction_id);
      if (!existing || r.similarity > existing.score) {
        byInteraction.set(r.interaction_id, { snippet: r.chunk_text, score: r.similarity });
      }
    }
    for (const r of keyword ?? []) {
      if (!byInteraction.has(r.interaction_id)) {
        byInteraction.set(r.interaction_id, { snippet: r.text, score: 0.5 });
      }
    }

    // Load meeting context + enforce visibility
    const ids = [...byInteraction.keys()];
    if (ids.length === 0) return NextResponse.json({ results: [] });

    let mq = db.from("interactions")
      .select("id, title, occurred_at, user_id, deals(id, name)")
      .in("id", ids);
    if (!canSeeAllMeetings(user)) {
      mq = mq.or(`user_id.eq.${user.id},user_id.is.null`);
    }
    const { data: meetings } = await mq;

    const results = (meetings ?? [])
      .map((m: any) => ({
        interactionId: m.id,
        title: m.title,
        occurredAt: m.occurred_at,
        dealName: m.deals?.name ?? null,
        dealId: m.deals?.id ?? null,
        snippet: byInteraction.get(m.id)!.snippet.slice(0, 240),
        score: byInteraction.get(m.id)!.score,
      }))
      .sort((a, b) => b.score - a.score);

    return NextResponse.json({ results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
