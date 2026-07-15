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
    const secret = process.env.RECALL_WEBHOOK_SECRET;
    if (!secret) throw new Error("RECALL_WEBHOOK_SECRET env var is not set");
    const wh = new Webhook(secret);
    // Recall sends white-labeled Svix headers (webhook-*); accept both namings
    const h = (name: string) =>
      req.headers.get(`svix-${name}`) ?? req.headers.get(`webhook-${name}`) ?? "";
    wh.verify(payload, {
      "svix-id": h("id"),
      "svix-timestamp": h("timestamp"),
      "svix-signature": h("signature"),
    });
  } catch (e: any) {
    console.error(`Webhook verification failed: ${e.message}`);
    return NextResponse.json({ error: `verification failed: ${e.message}` }, { status: 401 });
  }

  const evt = JSON.parse(payload);
  const eventType: string = evt.event ?? "";

  // Calendar changed → re-run auto-join rules for that calendar
  if (eventType.startsWith("calendar.")) {
    const calendarId = evt.data?.calendar_id ?? evt.data?.calendar?.id;
    if (calendarId) {
      const { syncCalendar } = await import("@/lib/autojoin");
      waitUntil(
        syncCalendar(calendarId)
          .then((r) => console.log(`Calendar sync ${calendarId}:`, JSON.stringify(r)))
          .catch((e) => console.error(`Calendar sync failed ${calendarId}: ${e.message}`))
      );
    }
    return NextResponse.json({ ok: true, calendar: true });
  }

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
