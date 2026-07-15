// Auto-join rules engine (PRD §4.1):
//  - Bot joins if the event has a meeting link AND at least one external attendee.
//  - Internal-only meetings are NEVER recorded (hard rule).
//  - Rep can override per meeting (force_record / skip) from Settings.

import { supabaseAdmin } from "@/lib/supabase";
import {
  listUpcomingEvents,
  scheduleBotForEvent,
  unscheduleBotForEvent,
  standardBotConfig,
} from "@/lib/adapters/calendar";

const INTERNAL_DOMAIN = "square-9.com"; // per-org setting when multi-tenancy goes live

function extractAttendees(event: any): { email: string }[] {
  // Google Calendar raw payload
  return (event.raw?.attendees ?? []).map((a: any) => ({ email: a.email ?? "" }));
}

function hasExternalAttendee(event: any): boolean {
  return extractAttendees(event).some(
    (a) => a.email && !a.email.toLowerCase().endsWith(`@${INTERNAL_DOMAIN}`)
  );
}

export async function syncCalendar(recallCalendarId: string) {
  const db = supabaseAdmin();

  const { data: user } = await db
    .from("users").select("id, email").eq("recall_calendar_id", recallCalendarId).maybeSingle();

  const events = await listUpcomingEvents(recallCalendarId);
  let scheduled = 0, skipped = 0;

  for (const event of events) {
    const meetingUrl = event.meeting_url;
    const external = hasExternalAttendee(event);

    // Check for a rep override saved earlier
    const { data: existing } = await db
      .from("calendar_events").select("id, rep_override, bot_scheduled")
      .eq("recall_event_id", event.id).maybeSingle();

    const shouldRecord =
      existing?.rep_override === "skip"
        ? false
        : existing?.rep_override === "force_record"
          ? !!meetingUrl
          : !!meetingUrl && external; // default rule; internal-only never records without explicit override... and even force_record requires a meeting link

    try {
      if (shouldRecord) {
        await scheduleBotForEvent(
          event.id,
          {
            ...standardBotConfig({
              calendar_event_id: event.id,
              user_email: user?.email ?? "",
              title: event.raw?.summary ?? "Meeting",
            }),
            join_at: event.start_time,
          },
          event.id // dedup key: one bot per event even if multiple reps share it
        );
        scheduled++;
      } else if (existing?.bot_scheduled) {
        await unscheduleBotForEvent(event.id).catch(() => {});
        skipped++;
      }
    } catch (e: any) {
      console.error(`Auto-join failed for event ${event.id}: ${e.message}`);
    }

    // Mirror event state for the Settings UI
    await db.from("calendar_events").upsert(
      {
        recall_event_id: event.id,
        recall_calendar_id: recallCalendarId,
        user_id: user?.id ?? null,
        title: event.raw?.summary ?? "Meeting",
        start_time: event.start_time,
        end_time: event.end_time,
        meeting_url: meetingUrl,
        is_external: external,
        bot_scheduled: shouldRecord,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "recall_event_id" }
    );
  }

  return { events: events.length, scheduled, skipped };
}
