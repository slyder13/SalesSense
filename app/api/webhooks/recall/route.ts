import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { waitUntil } from "@vercel/functions";
import { processBotDone } from "@/lib/pipeline";

// Background work (extraction + drafts) can take a while
export const maxDuration = 300;

// Recall status-change webhooks (Svix-signed).
// Svix only waits ~15s for a response, so we verify + acknowledge immediately,
// then run the AI pipeline in the background via waitUntil.
export async function POST(req: NextRequest) {
  const payload = await req.text();

  // 1. Verify this really came from Recall
  try {
    const wh = new Webhook(process.env.RECALL_WEBHOOK_SECRET!);
    wh.verify(payload, {
      "svix-id": req.headers.get("svix-id") ?? "",
      "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
      "svix-signature": req.headers.get("svix-signature") ?? "",
    });
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const evt = JSON.parse(payload);
  const eventType: string = evt.event ?? "";
  const botId: string | undefined =
    evt.data?.bot?.id ?? evt.data?.bot_id ?? evt.data?.data?.bot?.id;

  // 2. transcript.done is the reliable "everything is ready" signal.
  //    bot.done often fires before the transcript artifact exists, so we skip it
  //    (the transcript.done that follows will trigger the pipeline).
  if (!botId || !eventType.includes("transcript.done")) {
    return NextResponse.json({ ok: true, skipped: eventType });
  }

  // 3. Acknowledge now, process in the background (idempotent — retries are safe)
  waitUntil(
    processBotDone(botId)
      .then((r) => console.log(`Pipeline for bot ${botId}:`, JSON.stringify(r)))
      .catch((e) => console.error(`Pipeline failed for bot ${botId}: ${e.message}`))
  );

  return NextResponse.json({ ok: true, processing: botId });
}
