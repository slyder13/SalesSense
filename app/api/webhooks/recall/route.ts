import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { processBotDone } from "@/lib/pipeline";

// Allow up to 5 minutes: ingest + extraction + drafts run inside this request
export const maxDuration = 300;

// Recall status-change webhooks (Svix-signed).
// Configure in Recall dashboard → Webhooks → Add Endpoint:
//   https://YOUR-APP.vercel.app/api/webhooks/recall
// Then copy the endpoint's Signing Secret into env var RECALL_WEBHOOK_SECRET.
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
  const botId: string | undefined = evt.data?.bot?.id ?? evt.data?.bot_id;

  // 2. We only act when the recording/transcript is complete
  const triggers = ["bot.done", "transcript.done", "analysis_done"];
  if (!botId || !triggers.some((t) => eventType.includes(t))) {
    return NextResponse.json({ ok: true, skipped: eventType });
  }

  // 3. Run the full pipeline (idempotent — duplicate deliveries are safe)
  try {
    const result = await processBotDone(botId);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error(`Pipeline failed for bot ${botId}: ${e.message}`);
    // 500 tells Svix to retry later — gives transient failures a second chance
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
