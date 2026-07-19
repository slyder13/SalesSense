"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SfLink({ deal }: { deal: any }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function search(term: string) {
    setQ(term);
    setError(null);
    if (term.length < 2) return setResults([]);
    const res = await fetch(`/api/salesforce/search?q=${encodeURIComponent(term)}`);
    const data = await res.json();
    if (data.error) setError(data.error);
    else setResults(data.results);
  }

  async function link(opportunityId: string | null) {
    setBusy(true);
    const res = await fetch("/api/deal/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealId: deal.id, opportunityId }),
    });
    const data = await res.json();
    setBusy(false);
    if (data.error) return setError(data.error);
    setOpen(false);
    router.refresh();
  }

  if (deal.salesforce_opportunity_id) {
    return (
      <span style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
        SF: {deal.sf_account_name ?? ""} · {deal.sf_stage ?? "?"}
        {deal.sf_amount ? ` · $${Number(deal.sf_amount).toLocaleString()}` : ""}
        {deal.sf_close_date ? ` · closes ${deal.sf_close_date}` : ""}
        <button className="btn subtle" style={{ marginLeft: 8, padding: "2px 8px", fontSize: 11 }}
          onClick={() => link(null)} disabled={busy}>
          Unlink
        </button>
      </span>
    );
  }

  return (
    <span style={{ position: "relative" }}>
      <button className="btn subtle" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => setOpen(!open)}>
        Link Salesforce opp
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "110%", right: 0, zIndex: 10, width: 340,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 10, padding: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        }}>
          <input
            autoFocus
            value={q}
            onChange={(e) => search(e.target.value)}
            placeholder="Search opportunities by name or account..."
            style={{ width: "100%", padding: "8px 10px", fontSize: 13, marginBottom: 8 }}
          />
          {error && <p style={{ color: "var(--red)", fontSize: 12 }}>{error}</p>}
          {results.map((r) => (
            <div key={r.Id} className="insight-item" onClick={() => !busy && link(r.Id)}>
              <strong>{r.Name}</strong>
              <div className="src" style={{ color: "var(--text-dim)" }}>
                {r.Account?.Name} · {r.StageName}
                {r.Amount ? ` · $${Number(r.Amount).toLocaleString()}` : ""}
              </div>
            </div>
          ))}
          {q.length >= 2 && results.length === 0 && !error && (
            <p style={{ color: "var(--text-dim)", fontSize: 12 }}>No open opportunities match — keep the SalesSense name for now.</p>
          )}
        </div>
      )}
    </span>
  );
}
