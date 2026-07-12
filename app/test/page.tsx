"use client";
import { useState } from "react";

export default function TestBot() {
  const [url, setUrl] = useState("");
  const [botId, setBotId] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<any>(null);
  const [ai, setAi] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const add = (m: string) => setLog((l) => [...l, `${new Date().toLocaleTimeString()} — ${m}`]);

  async function sendBot() {
    setBusy(true);
    add("Sending bot to meeting...");
    try {
      const res = await fetch("/api/test-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingUrl: url }),
      });
      const data = await res.json();
      if (data.error) return add(`ERROR: ${data.error}`);
      setBotId(data.botId);
      add(`Bot created (${data.botId}). It should appear in the meeting lobby within ~30s — admit it!`);
    } catch (e: any) {
      add(`ERROR: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function checkStatus() {
    if (!botId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/test-bot?botId=${botId}`);
      const data = await res.json();
      if (data.error) return add(`ERROR: ${data.error}`);
      add(`Bot status: ${data.status}${data.transcriptReady ? " — transcript stored in database ✓" : " — transcript not ready yet"}`);
      if (data.transcriptReady) setResult(data);
    } catch (e: any) {
      add(`ERROR: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function runExtraction() {
    if (!result?.interactionId) return;
    setBusy(true);
    add("Running AI extraction (10-30 seconds)...");
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interactionId: result.interactionId }),
      });
      const data = await res.json();
      if (data.error) return add(`ERROR: ${data.error}`);
      add("Extraction complete — insights stored ✓");
      setAi(data);
    } catch (e: any) {
      add(`ERROR: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 700, margin: "3rem auto", padding: "0 1rem" }}>
      <h1>Milestone 1 — Bot Test</h1>
      <p>1. Paste a Teams/Zoom/Meet link. 2. Send the bot and admit it from the lobby. 3. Talk, then end the meeting. 4. Check status until the transcript lands.</p>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://teams.microsoft.com/meet/..."
        style={{ width: "100%", padding: 10, margin: "1rem 0", fontSize: 14 }}
      />
      <button onClick={sendBot} disabled={busy || !url} style={{ padding: "10px 20px", marginRight: 10 }}>
        Send bot
      </button>
      <button onClick={checkStatus} disabled={busy || !botId} style={{ padding: "10px 20px", marginRight: 10 }}>
        Check status / fetch transcript
      </button>
      <button
        onClick={async () => {
          try {
            const res = await fetch("/api/enrich");
            const data = await res.json();
            if (data.error) return add(`ERROR: ${data.error}`);
            setResult({ interactionId: data.interactionId, segmentCount: data.segmentCount, preview: [] });
            add(`Loaded stored meeting "${data.title}" (${data.segmentCount} segments) — ready for extraction`);
          } catch (e: any) {
            add(`ERROR: ${e.message}`);
          }
        }}
        disabled={busy}
        style={{ padding: "10px 20px" }}
      >
        Load last stored meeting
      </button>
      <pre style={{ background: "#f4f4f4", padding: 12, marginTop: "1.5rem", whiteSpace: "pre-wrap", fontSize: 13 }}>
        {log.join("\n") || "Waiting..."}
      </pre>
      {result && (
        <div style={{ marginTop: "1rem" }}>
          <h3>✓ {result.segmentCount} transcript segments stored (interaction {result.interactionId?.slice(0, 8)}…)</h3>
          {result.preview.map((s: any, i: number) => (
            <p key={i} style={{ margin: "6px 0" }}>
              <strong>{s.speakerLabel}:</strong> {s.text}
            </p>
          ))}
          <button onClick={runExtraction} disabled={busy} style={{ padding: "10px 20px", marginTop: 10 }}>
            Run AI extraction
          </button>
        </div>
      )}
      {ai && (
        <div style={{ marginTop: "1.5rem" }}>
          <h2>AI Extraction Results</h2>
          <h3>Summary</h3>
          <p><strong>Outcome:</strong> {ai.summary?.outcome}</p>
          <p><strong>Sentiment:</strong> {ai.summary?.sentiment}</p>
          {ai.summary?.competitors?.length > 0 && (
            <p><strong>Competitors:</strong> {ai.summary.competitors.map((c: any) => c.name).join(", ")}</p>
          )}
          <h3>Action Items</h3>
          {(ai.actionItems ?? []).map((a: any, i: number) => (
            <p key={i}>• {a.description} <em>({a.owner_side}{a.due_hint ? `, ${a.due_hint}` : ""})</em></p>
          ))}
          <h3>Scoping</h3>
          {(ai.scoping ?? []).map((s: any, i: number) => (
            <p key={i}>• <strong>{s.field}:</strong> {s.value}{s.unit ? ` ${s.unit}` : ""} — {s.context}</p>
          ))}
          <h3>Attendees</h3>
          {(ai.attendees ?? []).map((a: any, i: number) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <strong>{a.name}</strong> ({a.side})
              {(a.pain_points ?? []).map((p: any, j: number) => <p key={j} style={{ margin: 2 }}>　pain: {p.text}</p>)}
              {(a.interests ?? []).map((p: any, j: number) => <p key={j} style={{ margin: 2 }}>　interest: {p.text}</p>)}
              {(a.rapport_notes ?? []).map((p: any, j: number) => <p key={j} style={{ margin: 2 }}>　rapport: {p.text}</p>)}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
