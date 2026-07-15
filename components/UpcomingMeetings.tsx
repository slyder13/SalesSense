"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UpcomingMeetings({ events }: { events: any[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();

  async function setOverride(recallEventId: string, override: "force_record" | "skip" | null) {
    setBusy(recallEventId);
    await fetch("/api/calendar/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recallEventId, override }),
    });
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="card">
      <h3>Upcoming meetings</h3>
      {events.length === 0 && <p>No upcoming meetings synced yet.</p>}
      {events.map((e) => (
        <div key={e.id} className="meeting-row" style={{ border: "none", padding: "10px 0", marginBottom: 0 }}>
          <div>
            <div className="title" style={{ fontSize: 14 }}>{e.title}</div>
            <div className="meta">
              {new Date(e.start_time).toLocaleString()}
              {!e.meeting_url && " · no video link"}
              {e.meeting_url && (e.is_external ? " · external" : " · internal")}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {e.bot_scheduled ? (
              <span className="badge ready">will record</span>
            ) : (
              <span className="badge processing">won't record</span>
            )}
            {e.meeting_url && (
              <button
                className="btn subtle"
                disabled={busy === e.recall_event_id}
                onClick={() =>
                  setOverride(e.recall_event_id, e.bot_scheduled ? "skip" : "force_record")
                }
              >
                {e.bot_scheduled ? "Skip this one" : "Record anyway"}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
