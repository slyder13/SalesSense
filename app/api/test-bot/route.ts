import { NextRequest, NextResponse } from "next/server";
import { sendBotToMeeting, getBot, botStatus } from "@/lib/adapters/recording";
import { supabaseAdmin } from "@/lib/supabase";
import { ingestBotRecording } from "@/lib/pipeline";

export const maxDuration = 300;

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

// GET ?botId=x → checks status; when transcript is ready, ingests via shared pipeline
export async function GET(req: NextRequest) {
  try {
    const botId = req.nextUrl.searchParams.get("botId");
    if (!botId) return NextResponse.json({ error: "botId required" }, { status: 400 });

    const bot = await getBot(botId);
    const status = botStatus(bot);

    const ingested = await ingestBotRecording(botId);
    if (!ingested) return NextResponse.json({ status, transcriptReady: false });

    const db = supabaseAdmin();
    const { data: preview } = await db
      .from("transcript_segments").select("speaker_label, text")
      .eq("interaction_id", ingested.interactionId).order("start_ms").limit(5);

    return NextResponse.json({
      status,
      transcriptReady: true,
      interactionId: ingested.interactionId,
      segmentCount: ingested.segmentCount,
      preview: (preview ?? []).map((s) => ({ speakerLabel: s.speaker_label, text: s.text })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
