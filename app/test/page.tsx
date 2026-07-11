"use client";
import { useState } from "react";

export default function TestBot() {
  const [url, setUrl] = useState("");
  const [botId, setBotId] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const add = (m: string) => setLog((l) => [...l, `${new Date().toLocaleTimeString()} — ${m}`]);

  async function sendBot() {
    setBusy(true);
    add("Sending bot to meeting...");
    const res = await fetch("/api/test-bot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingUrl: url }),
    });
    const data = await res.json();
    setBusy(false);
    if (data.error) return add(`ERROR: ${data.error}`);
    setBotId(data.botId);
    add(`Bot created (${data.botId}). It should appear in the meeting lobby within ~30s — admit it!`);
  }

  async function checkStatus() {
    if (!botId) return;
    setBusy(true);
    const res = await fetch(`/api/test-bot?botId=${botId}`);
    const data = await res.json();
    setBusy(false);
    if (data.error) return add(`ERROR: ${data.error}`);
    add(`Bot status: ${data.status}${data.transcriptReady ? " — transcript stored in database ✓" : " — transcript not ready yet"}`);
    if (data.transcriptReady) setResult(data);
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
      <button onClick={checkStatus} disabled={busy || !botId} style={{ padding: "10px 20px" }}>
        Check status / fetch transcript
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
        </div>
      )}
    </main>
  );
}
