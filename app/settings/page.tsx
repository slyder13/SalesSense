import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import UpcomingMeetings from "@/components/UpcomingMeetings";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    calendar_connected?: string; calendar_error?: string;
    sf_connected?: string; sf_error?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await supabaseServer();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  const db = supabaseAdmin();
  const { data: user } = await db
    .from("users")
    .select("id, email, recall_calendar_id, calendar_connected_at_v2")
    .eq("email", authUser?.email ?? "")
    .maybeSingle();

  const connected = !!user?.recall_calendar_id;

  const { data: sfConn } = await db
    .from("salesforce_connections")
    .select("instance_url, connected_by")
    .maybeSingle();
  const sfConnected = !!sfConn;

  const { data: events } = connected
    ? await db
        .from("calendar_events")
        .select("id, recall_event_id, title, start_time, meeting_url, is_external, bot_scheduled, rep_override")
        .eq("user_id", user!.id)
        .gte("start_time", new Date().toISOString())
        .order("start_time")
        .limit(20)
    : { data: [] };

  return (
    <div>
      <div className="page-title">Settings</div>
      <div className="page-sub">Signed in as {authUser?.email}</div>

      {params.calendar_connected && (
        <div className="card" style={{ borderColor: "var(--green)" }}>
          Calendar connected ✓ — meetings will sync within a couple of minutes.
        </div>
      )}
      {params.calendar_error && (
        <div className="card" style={{ borderColor: "var(--red)" }}>
          Calendar connection failed: {params.calendar_error}
        </div>
      )}

      <div className="card">
        <h3>Calendar</h3>
        {connected ? (
          <p>
            Google Calendar connected ({user?.email}). The bot automatically joins meetings
            that have a video link and at least one attendee outside square-9.com.
            Internal-only meetings are never recorded.
          </p>
        ) : (
          <div>
            <p style={{ marginBottom: 12 }}>
              Connect your Google Calendar and the Square 9 Notetaker joins your external
              meetings automatically — no more pasting links.
            </p>
            <a href="/api/calendar/connect">
              <button className="btn">Connect Google Calendar</button>
            </a>
          </div>
        )}
      </div>

      {params.sf_connected && (
        <div className="card" style={{ borderColor: "var(--green)" }}>
          Salesforce connected ✓ — you can now link deals to opportunities.
        </div>
      )}
      {params.sf_error && (
        <div className="card" style={{ borderColor: "var(--red)" }}>
          Salesforce connection failed: {params.sf_error}
        </div>
      )}

      <div className="card">
        <h3>Salesforce</h3>
        {sfConnected ? (
          <p>
            Connected to {sfConn!.instance_url} (by {sfConn!.connected_by}). Deals can be
            linked to Opportunities from any deal page.
          </p>
        ) : (
          <div>
            <p style={{ marginBottom: 12 }}>
              Connect Salesforce once for the whole team — then any deal can be linked to
              its Opportunity, pulling stage, amount, and close date.
            </p>
            <a href="/api/salesforce/connect">
              <button className="btn">Connect Salesforce</button>
            </a>
          </div>
        )}
      </div>

      {connected && <UpcomingMeetings events={events ?? []} />}
    </div>
  );
}
