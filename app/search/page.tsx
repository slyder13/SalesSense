"use client";
import { useState } from "react";
import Link from "next/link";

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.error) setError(data.error);
      else setResults(data.results);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-title">Search</div>
      <div className="page-sub">
        Search every call by meaning, not just keywords — try "who worried about implementation time" or "invoice volume".
      </div>

      <form onSubmit={run} style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search across all transcripts..."
          style={{ flex: 1, padding: "10px 12px", fontSize: 14 }}
          autoFocus
        />
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Searching..." : "Search"}
        </button>
      </form>

      {error && <div className="card" style={{ borderColor: "var(--red)" }}>{error}</div>}

      {results && results.length === 0 && (
        <div className="card">No matches. Try different words, or check that meetings have finished processing.</div>
      )}

      {results?.map((r) => (
        <Link key={r.interactionId} href={`/meetings/${r.interactionId}`}>
          <div className="card" style={{ cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>{r.title ?? "Meeting"}</strong>
              <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                {new Date(r.occurredAt).toLocaleDateString()}
                {r.dealName ? ` · ${r.dealName}` : ""}
              </span>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 6, whiteSpace: "pre-wrap" }}>
              …{r.snippet}…
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
