"use client";
import { useState } from "react";
import { DEBRIEF_QUESTIONS } from "@/lib/prompts/debrief";

const VERDICT_COLORS: Record<string, string> = {
  "Full Proceed": "var(--green)",
  "Pause": "var(--amber)",
  "Disqualify": "var(--red)",
};

export default function Debrief({
  insight, onShowSource,
}: {
  insight: any; // insights row with kind='debrief'
  onShowSource: (segmentIds?: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<any>(insight.payload);
  const [saving, setSaving] = useState(false);

  const ratings = [...DEBRIEF_QUESTIONS.map((q) => payload[q.id]?.rating), payload.q11?.rating, payload.q12?.rating]
    .filter((n) => n >= 1);
  const avg = ratings.length ? (ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length) : null;

  async function setRating(qid: string, rating: number) {
    const next = { ...payload, [qid]: { ...payload[qid], rating, rep_adjusted: true } };
    setPayload(next);
    setSaving(true);
    await fetch("/api/debrief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ insightId: insight.id, payload: next }),
    });
    setSaving(false);
  }

  const Stars = ({ qid }: { qid: string }) => (
    <span style={{ whiteSpace: "nowrap" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          onClick={() => setRating(qid, n)}
          style={{
            cursor: "pointer", padding: "0 2px", fontSize: 15,
            color: n <= (payload[qid]?.rating ?? 0) ? "var(--amber)" : "var(--border)",
          }}
        >
          ●
        </span>
      ))}
    </span>
  );

  return (
    <div className="card">
      <h3 onClick={() => setOpen(!open)} style={{ cursor: "pointer", marginBottom: open ? 10 : 0 }}>
        Team debrief (internal) — {avg ? `${avg.toFixed(1)}/5` : "—"}
        {payload.q12?.verdict && (
          <span style={{ marginLeft: 10, color: VERDICT_COLORS[payload.q12.verdict] ?? "inherit", textTransform: "none" }}>
            {payload.q12.verdict}
          </span>
        )}
        <span style={{ float: "right", color: "var(--text-dim)" }}>{open ? "▾ hide" : "▸ show"}</span>
      </h3>
      {open && (
        <div style={{ fontSize: 13 }}>
          <p style={{ color: "var(--text-dim)", fontSize: 12, marginBottom: 10 }}>
            AI-scored coaching review of our team's performance — click any score to adjust it,
            click a note to see the evidence in the transcript. {saving && "Saving..."}
          </p>
          {DEBRIEF_QUESTIONS.map((q, i) => (
            <div key={q.id} style={{ display: "flex", gap: 10, padding: "7px 0", borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
              <Stars qid={q.id} />
              <div>
                <strong>{q.title}</strong>
                <div
                  className="insight-item"
                  style={{ padding: "2px 0", color: "var(--text-dim)" }}
                  onClick={() => onShowSource(payload[q.id]?.segment_ids)}
                >
                  {payload[q.id]?.notes ?? "—"}
                </div>
              </div>
            </div>
          ))}
          <div style={{ borderTop: "1px solid var(--border)", padding: "8px 0" }}>
            <Stars qid="q11" /> <strong>Team Dynamics</strong>
            <div style={{ marginTop: 4, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <div className="draft-box" style={{ marginTop: 0 }}><span style={{ color: "var(--red)", fontSize: 11 }}>STOP</span><br />{payload.q11?.stop ?? "—"}</div>
              <div className="draft-box" style={{ marginTop: 0 }}><span style={{ color: "var(--green)", fontSize: 11 }}>START</span><br />{payload.q11?.start ?? "—"}</div>
              <div className="draft-box" style={{ marginTop: 0 }}><span style={{ fontSize: 11, color: "var(--text-dim)" }}>CONTINUE</span><br />{payload.q11?.continue ?? "—"}</div>
            </div>
          </div>
          <div style={{ borderTop: "1px solid var(--border)", padding: "8px 0" }}>
            <Stars qid="q12" /> <strong>Engagement Verdict:</strong>{" "}
            <span style={{ color: VERDICT_COLORS[payload.q12?.verdict] ?? "inherit", fontWeight: 600 }}>
              {payload.q12?.verdict ?? "—"}
            </span>
            <div className="insight-item" style={{ padding: "2px 0", color: "var(--text-dim)" }}
              onClick={() => onShowSource(payload.q12?.segment_ids)}>
              {payload.q12?.notes ?? ""}
            </div>
          </div>
          <div style={{ borderTop: "1px solid var(--border)", padding: "8px 0" }}>
            <strong>Follow-up booked before call ended:</strong>{" "}
            <span style={{
              fontWeight: 600,
              color: payload.follow_up?.status?.startsWith("Scheduled") ? "var(--green)"
                : payload.follow_up?.status === "Not scheduled" ? "var(--red)" : "var(--amber)",
            }}>
              {payload.follow_up?.status ?? "—"}
            </span>
            <div className="insight-item" style={{ padding: "2px 0", color: "var(--text-dim)" }}
              onClick={() => onShowSource(payload.follow_up?.segment_ids)}>
              {payload.follow_up?.details ?? ""}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
