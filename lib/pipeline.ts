// The ingestion + enrichment pipeline. Single source of truth — called by the
// webhook (automatic), and by the test page routes (manual).
// Every step is idempotent: safe to run twice on the same bot/interaction.

import { supabaseAdmin } from "@/lib/supabase";
import { getTranscript, getBot } from "@/lib/adapters/recording";
import { extractMeetingIntelligence, generateDrafts, generateDebrief, MODEL, PROMPT_VERSION, DRAFTS_PROMPT_VERSION, DEBRIEF_PROMPT_VERSION } from "@/lib/ai";

// ---------- Step 1: ingest transcript from a finished bot ----------
export async function ingestBotRecording(botId: string): Promise<{ interactionId: string; segmentCount: number } | null> {
  const db = supabaseAdmin();

  const { data: existing } = await db
    .from("interactions").select("id, transcript_segments(count)").eq("source_ref", botId).maybeSingle();
  if (existing) {
    return { interactionId: existing.id, segmentCount: (existing as any).transcript_segments?.[0]?.count ?? 0 };
  }

  const segments = await getTranscript(botId);
  if (!segments?.length) return null;

  const bot = await getBot(botId).catch(() => null);
  const title = bot?.metadata?.title ?? "Meeting";

  // Attribution: calendar-scheduled bots carry the rep's email in metadata
  let userId: string | null = null;
  const repEmail = bot?.metadata?.user_email;
  if (repEmail) {
    const { data: owner } = await db
      .from("users").select("id").eq("email", repEmail).maybeSingle();
    userId = owner?.id ?? null;
  }

  const { data: interaction, error: iErr } = await db
    .from("interactions")
    .insert({
      type: "meeting", source: "recall", source_ref: botId, title, user_id: userId,
      occurred_at: new Date().toISOString(),
      duration_s: Math.round((segments[segments.length - 1].endMs ?? 0) / 1000),
      status: "ready",
    })
    .select("id").single();
  if (iErr) throw new Error(`DB insert failed: ${iErr.message}`);

  const { error: sErr } = await db.from("transcript_segments").insert(
    segments.map((s) => ({
      interaction_id: interaction.id, speaker_label: s.speakerLabel,
      start_ms: s.startMs, end_ms: s.endMs, text: s.text,
    }))
  );
  if (sErr) throw new Error(`Segment insert failed: ${sErr.message}`);

  // Talk-time % — deterministic, no AI
  const talk: Record<string, number> = {};
  for (const s of segments) talk[s.speakerLabel] = (talk[s.speakerLabel] ?? 0) + (s.endMs - s.startMs);
  const total = Object.values(talk).reduce((a, b) => a + b, 0) || 1;
  await db.from("participants").insert(
    Object.entries(talk).map(([name, ms]) => ({
      interaction_id: interaction.id, name, speaker_label: name,
      talk_ms: ms, talk_pct: Math.round((ms / total) * 10000) / 100,
    }))
  );

  return { interactionId: interaction.id, segmentCount: segments.length };
}

// ---------- Step 2: AI extraction ----------
export async function enrichInteraction(interactionId: string) {
  const db = supabaseAdmin();

  const { data: segments, error: segErr } = await db
    .from("transcript_segments").select("id, speaker_label, text")
    .eq("interaction_id", interactionId).order("start_ms");
  if (segErr) throw new Error(segErr.message);
  if (!segments?.length) throw new Error("No transcript found");

  // Ensure a deal exists (deal-level intelligence needs one)
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

  // Idempotency: if a summary for this prompt version already exists, return it
  const { data: prior } = await db
    .from("insights").select("payload").eq("interaction_id", interactionId)
    .eq("kind", "summary").eq("prompt_version", PROMPT_VERSION).maybeSingle();

  const numbered = segments.map((s, i) => ({ idx: i, speaker: s.speaker_label ?? "?", text: s.text }));
  const extracted = prior ? null : await extractMeetingIntelligence(numbered);
  if (!extracted) {
    return { dealId, alreadyEnriched: true };
  }

  const toIds = (refs?: number[]) => (refs ?? []).map((r) => segments[r]?.id).filter(Boolean);
  const meta = { interaction_id: interactionId, deal_id: dealId, prompt_version: PROMPT_VERSION, model: MODEL };

  const { error: insErr } = await db.from("insights").insert([
    { ...meta, kind: "summary", payload: extracted.summary, segment_ids: toIds(extracted.summary?.topics?.flatMap((t: any) => t.segment_refs)) },
    ...(extracted.action_items ?? []).map((a: any) => ({
      ...meta, kind: "action_item", payload: a, segment_ids: toIds(a.segment_refs),
    })),
  ]);
  if (insErr) throw new Error(insErr.message);

  // Scoping: append-only living profile with change flags
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

  // Attendee profiles: accumulate across meetings
  for (const a of extracted.attendees ?? []) {
    if (a.side !== "external") continue;
    const email = a.name.toLowerCase().replace(/\s+/g, ".") + "@unknown"; // real emails come with calendar integration
    const tag = (items: any[]) =>
      (items ?? []).map((i: any) => ({ ...i, interaction_id: interactionId, segment_ids: toIds(i.segment_refs) }));
    const { data: existingProfile } = await db
      .from("attendee_profiles").select("*").eq("deal_id", dealId).eq("email", email).maybeSingle();
    if (existingProfile) {
      await db.from("attendee_profiles").update({
        pain_points: [...existingProfile.pain_points, ...tag(a.pain_points)],
        interests: [...existingProfile.interests, ...tag(a.interests)],
        rapport_notes: [...existingProfile.rapport_notes, ...tag(a.rapport_notes)],
        // AI fills blanks but never overwrites what a rep typed
        title: existingProfile.title ?? a.title ?? null,
        sales_role: existingProfile.sales_role ?? a.suggested_sales_role ?? null,
        updated_at: new Date().toISOString(),
      }).eq("id", existingProfile.id);
    } else {
      await db.from("attendee_profiles").insert({
        deal_id: dealId, email, name: a.name,
        title: a.title ?? null,
        sales_role: a.suggested_sales_role ?? null,
        pain_points: tag(a.pain_points), interests: tag(a.interests), rapport_notes: tag(a.rapport_notes),
      });
    }
  }

  return { dealId, extracted };
}

// ---------- Step 3: drafts ----------
export async function draftInteraction(interactionId: string, repName = "Chris") {
  const db = supabaseAdmin();

  const { data: insights, error } = await db
    .from("insights").select("kind, payload, deal_id, created_at")
    .eq("interaction_id", interactionId).in("kind", ["summary", "action_item"])
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const summary = insights?.find((i) => i.kind === "summary");
  if (!summary) throw new Error("No insights found — run AI extraction first");
  const actionItems = insights!.filter((i) => i.kind === "action_item").map((i) => i.payload);

  const dealId = summary.deal_id;
  const [{ data: scoping }, { data: attendees }, { data: priorSummaries }] = await Promise.all([
    db.from("deal_scoping").select("field, value, unit, context").eq("deal_id", dealId).is("superseded_by", null),
    db.from("attendee_profiles").select("name, pain_points, interests").eq("deal_id", dealId),
    db.from("insights").select("payload, created_at")
      .eq("deal_id", dealId).eq("kind", "summary").neq("interaction_id", interactionId)
      .order("created_at", { ascending: false }).limit(3),
  ]);

  const drafts = await generateDrafts({
    repName,
    extracted: { summary: summary.payload, action_items: actionItems, scoping, attendees },
    priorMeetings: priorSummaries?.map((p) => p.payload),
  });

  const meta = { interaction_id: interactionId, deal_id: dealId, prompt_version: DRAFTS_PROMPT_VERSION, model: MODEL };
  const { error: insErr } = await db.from("insights").insert([
    { ...meta, kind: "email_draft", payload: drafts.email },
    { ...meta, kind: "crm_note", payload: { text: drafts.crm_note } },
  ]);
  if (insErr) throw new Error(insErr.message);

  return drafts;
}

// ---------- Step 4: debrief scorecard (internal coaching) ----------
export async function debriefInteraction(interactionId: string) {
  const db = supabaseAdmin();

  // Idempotent: skip if a debrief for this prompt version already exists
  const { data: prior } = await db
    .from("insights").select("id").eq("interaction_id", interactionId)
    .eq("kind", "debrief").eq("prompt_version", DEBRIEF_PROMPT_VERSION).maybeSingle();
  if (prior) return { alreadyDone: true };

  const { data: segments, error } = await db
    .from("transcript_segments").select("id, speaker_label, text")
    .eq("interaction_id", interactionId).order("start_ms");
  if (error) throw new Error(error.message);
  if (!segments?.length) throw new Error("No transcript found");

  const { data: interaction } = await db
    .from("interactions").select("deal_id").eq("id", interactionId).single();

  const numbered = segments.map((s, i) => ({ idx: i, speaker: s.speaker_label ?? "?", text: s.text }));
  const debrief = await generateDebrief(numbered);
  const toIds = (refs?: number[]) => (refs ?? []).map((r) => segments[r]?.id).filter(Boolean);

  // Map segment_refs → real ids inside the payload so the UI can link evidence
  for (const key of Object.keys(debrief)) {
    if (debrief[key]?.segment_refs) debrief[key].segment_ids = toIds(debrief[key].segment_refs);
  }

  const { error: insErr } = await db.from("insights").insert({
    interaction_id: interactionId,
    deal_id: interaction?.deal_id ?? null,
    kind: "debrief",
    payload: debrief,
    prompt_version: DEBRIEF_PROMPT_VERSION,
    model: MODEL,
  });
  if (insErr) throw new Error(insErr.message);
  return { debrief };
}

// ---------- Full automatic pipeline (webhook entry point) ----------
export async function processBotDone(botId: string) {
  const ingested = await ingestBotRecording(botId);
  if (!ingested) return { ok: false, reason: "transcript not ready" };
  await enrichInteraction(ingested.interactionId);
  await draftInteraction(ingested.interactionId);
  await debriefInteraction(ingested.interactionId).catch((e) =>
    console.error(`Debrief failed for ${ingested.interactionId}: ${e.message}`)
  );
  return { ok: true, interactionId: ingested.interactionId };
}
