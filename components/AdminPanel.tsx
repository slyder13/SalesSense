"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminPanel({ users, org, currentUserId }: any) {
  const [botName, setBotName] = useState(org.botName);
  const [disclosure, setDisclosure] = useState(org.disclosureMessage);
  const [domains, setDomains] = useState(org.allowedDomains.join(", "));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function setRole(userId: string, role: string) {
    setError(null);
    const res = await fetch("/api/admin/user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    const data = await res.json();
    if (data.error) setError(data.error);
    router.refresh();
  }

  async function saveOrg() {
    setError(null);
    const res = await fetch("/api/admin/org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        botName,
        disclosureMessage: disclosure,
        allowedDomains: domains.split(",").map((d: string) => d.trim()).filter(Boolean),
      }),
    });
    const data = await res.json();
    if (data.error) return setError(data.error);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  return (
    <div>
      <div className="page-title">Admin</div>
      <div className="page-sub">Team roles and organization settings.</div>
      {error && <div className="card" style={{ borderColor: "var(--red)" }}>{error}</div>}

      <div className="card">
        <h3>Team</h3>
        {users.map((u: any) => (
          <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{u.name ?? u.email}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
                {u.email} · {u.recall_calendar_id ? "calendar connected" : "no calendar"}
              </div>
            </div>
            {u.id === currentUserId ? (
              <span className="badge ready">{u.role} (you)</span>
            ) : (
              <select value={u.role} onChange={(e) => setRole(u.id, e.target.value)} style={{ fontSize: 13, padding: "4px 8px" }}>
                <option value="rep">rep</option>
                <option value="manager">manager</option>
                <option value="admin">admin</option>
              </select>
            )}
          </div>
        ))}
        <p style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 8 }}>
          New teammates appear here automatically after their first sign-in (default role: rep).
        </p>
      </div>

      <div className="card">
        <h3>Organization</h3>
        <div style={{ display: "grid", gap: 12, maxWidth: 560 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>
              Bot display name (shown in meetings)
            </label>
            <input value={botName} onChange={(e) => setBotName(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", fontSize: 14 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>
              Recording disclosure message (posted in meeting chat when the bot joins)
            </label>
            <textarea value={disclosure} onChange={(e) => setDisclosure(e.target.value)}
              rows={2} style={{ width: "100%", padding: "8px 10px", fontSize: 14 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>
              Internal email domains (comma-separated; meetings with only these domains are never recorded)
            </label>
            <input value={domains} onChange={(e) => setDomains(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", fontSize: 14 }} />
          </div>
          <div>
            <button className="btn" onClick={saveOrg}>{saved ? "Saved ✓" : "Save settings"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
