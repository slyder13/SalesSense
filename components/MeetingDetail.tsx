"use client";
import { useState, useRef } from "react";

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function MeetingDetail({
  meeting, segments, participants, summary, actionItems, emailDraft, crmNote,
}: any) {
  const [highlighted, setHighlighted] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Click an insight → highlight + scroll to its source segments
  function showSource(segmentIds?: string[]) {
    if (!segmentIds?.length) return;
    setHighlighted(segmentIds);
    const el = document.getElementById(`seg-${segmentIds[0]}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  const sum = summary?.payload;

  return (
    <div>
      <div className="page-title">{meeting.title ?? "Meeting"}</div>
      <div className="page-sub">
        {new Date(meeting.occurred_at).toLocaleString()}
        {meeting.duration_s ? ` · ${Math.round(meeting.duration_s / 60)} min` : ""}
        {meeting.deals?.name ? ` · ${meeting.deals.name}` : ""}
      </div>

      <div className="detail-grid">
        {/* ---- Left column: intelligence ---- */}
        <div>
          {sum && (
            <div className="card">
              <h3>Summary</h3>
              <p style={{ marginBottom: 8 }}><strong>{sum.outcome}</strong></p>
              <p style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 8 }}>
                Sentiment: {sum.sentiment}
                {sum.competitors?.length > 0 && ` · Competitors: ${sum.competitors.map((c: any) => c.name).join(", ")}`}
              </p>
              {(sum.topics ?? []).map((t: any, i: number) => (
                <div key={i} className="insight-item" onClick={() => showSource(summary.segment_ids)}>
                  {t.text}
                </div>
              ))}
            </div>
          )}

          {actionItems.length > 0 && (
            <div className="card">
              <h3>Action items</h3>
              {actionItems.map((a: any) => (
                <div key={a.id} className="insight-item" onClick={() => showSource(a.segment_ids)}>
                  {a.payload.description}
                  <div className="src">
                    {a.payload.owner_side === "us" ? "Square 9" : "Customer"}
                    {a.payload.due_hint ? ` · ${a.payload.due_hint}` : ""} · click to see source
                  </div>
                </div>
              ))}
            </div>
          )}

          {participants.length > 0 && (
            <div className="card">
              <h3>Talk time</h3>
              {participants.map((p: any, i: number) => (
                <div key={i} className="talk-bar-row">
                  <div className="name">{p.name}</div>
                  <div className="talk-bar-track">
                    <div className="talk-bar-fill" style={{ width: `${p.talk_pct}%` }} />
                  </div>
                  <div className="pct">{Math.round(p.talk_pct)}%</div>
                </div>
              ))}
            </div>
          )}

          {emailDraft && (
            <div className="card">
              <h3>
                Follow-up email{" "}
                <button className="btn subtle" style={{ float: "right" }}
                  onClick={() => copy(`Subject: ${emailDraft.subject}\n\n${emailDraft.body}`, "email")}>
                  {copied === "email" ? "Copied ✓" : "Copy"}
                </button>
              </h3>
              <div className="draft-box">
                <strong>Subject: {emailDraft.subject}</strong>
                {"\n\n" + emailDraft.body}
              </div>
            </div>
          )}

          {crmNote && (
            <div className="card">
              <h3>
                CRM note{" "}
                <button className="btn subtle" style={{ float: "right" }}
                  onClick={() => copy(crmNote, "crm")}>
                  {copied === "crm" ? "Copied ✓" : "Copy"}
                </button>
              </h3>
              <div className="draft-box">{crmNote}</div>
            </div>
          )}

          {!sum && (
            <div className="card">
              <h3>Processing</h3>
              <p>AI extraction hasn't completed for this meeting yet. Refresh in a minute.</p>
            </div>
          )}
        </div>

        {/* ---- Right column: transcript ---- */}
        <div className="card">
          <h3>Transcript</h3>
          <div className="transcript" ref={transcriptRef}>
            {segments.map((s: any) => (
              <div
                key={s.id}
                id={`seg-${s.id}`}
                className={`segment ${highlighted.includes(s.id) ? "highlighted" : ""}`}
              >
                <span className="speaker">
                  {s.speaker_label}
                  <span className="time">{fmt(s.start_ms)}</span>
                </span>
                <div>{s.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
