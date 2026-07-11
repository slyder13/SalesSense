import { NextRequest, NextResponse } from "next/server";
import { sendBotToMeeting, getBot, getTranscript, botStatus } from "@/lib/adapters/recording";
import { supabaseAdmin } from "@/lib/supabase";

// POST { meetingUrl } → sends the bot, returns { botId }
export async function POST(req: NextRequest) {
  try {
    const { meetingUrl } = await req.json();
    if (!meetingUrl?.startsWith("http")) {
      return NextResponse.json({ error: "Paste a valid meeting link" }, { status: 400 });
    }
    const bot = await sendBotToMeeting(meetingUrl);
    return NextResponse.json({ botId: bot.id, status: botStatus(bot) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET ?botId=x → checks status; when transcript is ready, stores it in Supabase
export async function GET(req: NextRequest) {
  try {
    const botId = req.nextUrl.searchParams.get("botId");
    if (!botId) return NextResponse.json({ error: "botId required" }, { status: 400 });

    const bot = await getBot(botId);
    const status = botStatus(bot);
    const segments = await getTranscript(botId);

    if (!segments || segments.length === 0) {
      return NextResponse.json({ status, transcriptReady: false });
    }

    // Store in Supabase (idempotent: skip if this bot was already ingested)
    const db = supabaseAdmin();
    const { data: existing } = await db
      .from("interactions").select("id").eq("source_ref", botId).maybeSingle();

    let interactionId = existing?.id;
    if (!interactionId) {
      const { data: interaction, error: iErr } = await db
        .from("interactions")
        .insert({
          type: "meeting",
          source: "recall",
          source_ref: botId,
          title: "Test meeting",
          occurred_at: new Date().toISOString(),
          duration_s: Math.round((segments[segments.length - 1].endMs ?? 0) / 1000),
          status: "ready",
        })
        .select("id").single();
      if (iErr) throw new Error(`DB insert failed: ${iErr.message}`);
      interactionId = interaction.id;

      const { error: sErr } = await db.from("transcript_segments").insert(
        segments.map((s) => ({
          interaction_id: interactionId,
          speaker_label: s.speakerLabel,
          start_ms: s.startMs,
          end_ms: s.endMs,
          text: s.text,
        }))
      );
      if (sErr) throw new Error(`Segment insert failed: ${sErr.message}`);

      // Talk-time % per speaker — computed, not AI
      const talk: Record<string, number> = {};
      for (const s of segments) talk[s.speakerLabel] = (talk[s.speakerLabel] ?? 0) + (s.endMs - s.startMs);
      const total = Object.values(talk).reduce((a, b) => a + b, 0) || 1;
      await db.from("participants").insert(
        Object.entries(talk).map(([name, ms]) => ({
          interaction_id: interactionId,
          name,
          speaker_label: name,
          talk_ms: ms,
          talk_pct: Math.round((ms / total) * 10000) / 100,
        }))
      );
    }

    return NextResponse.json({
      status,
      transcriptReady: true,
      interactionId,
      segmentCount: segments.length,
      preview: segments.slice(0, 5),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
