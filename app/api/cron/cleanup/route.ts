import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { deleteBotMedia } from "@/lib/adapters/recording";

export const maxDuration = 300;

const RETENTION_DAYS = 30;

// Nightly (Vercel cron): delete recording media from Recall for meetings older
// than RETENTION_DAYS. Transcripts + insights stay in our database forever.
export async function GET(req: NextRequest) {
  // Vercel sends this header for configured crons when CRON_SECRET is set
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000).toISOString();

  const { data: due } = await db
    .from("interactions")
    .select("id, source_ref")
    .eq("source", "recall")
    .eq("status", "ready")
    .is("media_deleted_at", null)
    .lt("occurred_at", cutoff)
    .limit(50);

  let deleted = 0, failed = 0;
  for (const row of due ?? []) {
    try {
      await deleteBotMedia(row.source_ref!);
      await db.from("interactions")
        .update({ media_deleted_at: new Date().toISOString() }).eq("id", row.id);
      deleted++;
    } catch (e: any) {
      // 404s mean Recall already purged it — mark done; anything else, retry tomorrow
      if (String(e.message).includes("404")) {
        await db.from("interactions")
          .update({ media_deleted_at: new Date().toISOString() }).eq("id", row.id);
        deleted++;
      } else {
        console.error(`Media delete failed for ${row.source_ref}: ${e.message}`);
        failed++;
      }
    }
  }

  return NextResponse.json({ ok: true, deleted, failed, checked: due?.length ?? 0 });
}
