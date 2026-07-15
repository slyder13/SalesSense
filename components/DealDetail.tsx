"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const ROLES = ["champion", "decision_maker", "influencer", "blocker", "user", "unknown"];

function Field({ label, value, onSave }: { label: string; value: string | null; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value ?? "");
  if (editing) {
    return (
      <input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { setEditing(false); if (v !== (value ?? "")) onSave(v); }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        style={{ fontSize: 13, padding: "2px 6px", width: 150, textAlign: "right" }}
      />
    );
  }
  return (
    <span onClick={() => setEditing(true)} style={{ cursor: "pointer", color: value ? "inherit" : "var(--text-dim)" }}>
      {value || `add ${label}`}
    </span>
  );
}

export default function DealDetail({
  deal, stakeholders, interactions, scoping, summaries, latestSummary, actionItems, upcomingEvents,
}: any) {
  const [si, setSi] = useState(0); // stakeholder index
  const [tab, setTab] = useState<"status" | "scoping" | "activity" | "tasks">("status");
  const router = useRouter();

  const s = stakeholders[si];

  async function saveStakeholder(field: string, value: string) {
    await fetch("/api/stakeholder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: s.id, field, value }),
    });
    router.refresh();
  }

  // Current scoping profile: latest non-superseded value per field
  const currentScoping: Record<string, any> = {};
  const history: any[] = [];
  for (const row of scoping) {
    if (!row.superseded_by && !currentScoping[row.field]) currentScoping[row.field] = row;
    else history.push(row);
  }

  const budget = summaries.map((x: any) => x.payload?.budget).find((b: any) => b?.mentioned);
  const timeline = summaries.map((x: any) => x.payload?.timeline).find((t: any) => t?.mentioned);
  const competitors = [...new Set(summaries.flatMap((x: any) => (x.payload?.competitors ?? []).map((c: any) => c.name)))];
  const openTasks = actionItems.filter((a: any) => a.payload?.owner_side);

  const initials = (name: string) =>
    name.split(/\s+/).map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <span className="page-title" style={{ display: "inline" }}>{deal.name}</span>
          <span style={{ color: "var(--text-dim)", marginLeft: 12, fontSize: 13 }}>
            {interactions.length} meeting{interactions.length === 1 ? "" : "s"}
            {deal.salesforce_opportunity_id ? ` · SF: ${deal.salesforce_opportunity_id}` : ""}
          </span>
        </div>
        <span className="badge ready">{deal.status}</span>
      </div>
      <div className="page-sub" style={{ marginTop: 4 }}>{deal.company_domain}</div>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, alignItems: "start" }}>
        {/* ---- Stakeholder pager ---- */}
        <div>
          <div className="card" style={{ marginBottom: 10 }}>
            {stakeholders.length === 0 ? (
              <p style={{ color: "var(--text-dim)" }}>No stakeholders yet — they appear as meetings are processed.</p>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <button className="btn subtle" disabled={si === 0} onClick={() => setSi(si - 1)} style={{ padding: "4px 10px" }}>←</button>
                  <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{si + 1} of {stakeholders.length}</span>
                  <button className="btn subtle" disabled={si >= stakeholders.length - 1} onClick={() => setSi(si + 1)} style={{ padding: "4px 10px" }}>→</button>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                  <div style={{ width: 42, height: 42, borderRadius: "50%", background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 13 }}>
                    {initials(s.name ?? "?")}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                      <Field label="title" value={s.title} onSave={(v) => saveStakeholder("title", v)} />
                    </div>
                  </div>
                </div>
                <select
                  value={s.sales_role ?? "unknown"}
                  onChange={(e) => saveStakeholder("sales_role", e.target.value)}
                  style={{ fontSize: 12, padding: "3px 6px", marginBottom: 8 }}
                >
                  {ROLES.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
                </select>
                <table style={{ width: "100%", fontSize: 12.5 }}>
                  <tbody>
                    <tr><td style={{ color: "var(--text-dim)", padding: "3px 0" }}>Email</td><td style={{ textAlign: "right" }}>{s.email?.endsWith("@unknown") ? "—" : s.email}</td></tr>
                    <tr><td style={{ color: "var(--text-dim)", padding: "3px 0" }}>Phone</td><td style={{ textAlign: "right" }}><Field label="phone" value={s.phone} onSave={(v) => saveStakeholder("phone", v)} /></td></tr>
                    <tr><td style={{ color: "var(--text-dim)", padding: "3px 0" }}>Location</td><td style={{ textAlign: "right" }}><Field label="location" value={s.location} onSave={(v) => saveStakeholder("location", v)} /></td></tr>
                  </tbody>
                </table>
                {(s.rapport_notes?.length > 0 || s.pain_points?.length > 0) && (
                  <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 8, fontSize: 12.5 }}>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>CONNECT</div>
                    {s.rapport_notes?.map((r: any, i: number) => <div key={i}>{r.text}</div>)}
                    {s.pain_points?.slice(0, 3).map((p: any, i: number) => (
                      <div key={i} style={{ color: "var(--text-dim)" }}>Pain: {p.text}</div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 13 }}>{deal.name}</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
              {deal.company_location ?? deal.company_domain}
              {deal.company_blurb ? ` · ${deal.company_blurb}` : ""}
            </div>
          </div>
        </div>

        {/* ---- Tabs ---- */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)", padding: "6px 10px 0" }}>
            {(["status", "scoping", "activity", "tasks"] as const).map((t) => (
              <div
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: "8px 14px", fontSize: 13, cursor: "pointer", textTransform: "capitalize",
                  borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
                  fontWeight: tab === t ? 600 : 400,
                  color: tab === t ? "var(--text)" : "var(--text-dim)",
                }}
              >
                {t}
              </div>
            ))}
          </div>
          <div style={{ padding: 16 }}>
            {tab === "status" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13 }}>
                <div className="draft-box" style={{ marginTop: 0 }}>
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>BUDGET</div>
                  {budget ? `${budget.amount ?? ""} — ${budget.context ?? ""}` : "Not discussed yet"}
                </div>
                <div className="draft-box" style={{ marginTop: 0 }}>
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>TIMELINE</div>
                  {timeline ? [timeline.purchase_target && `Purchase: ${timeline.purchase_target}`, timeline.go_live_target && `Go-live: ${timeline.go_live_target}`].filter(Boolean).join(" · ") || timeline.context : "Not discussed yet"}
                </div>
                <div className="draft-box" style={{ marginTop: 0 }}>
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>COMPETITION</div>
                  {competitors.length ? competitors.join(", ") : "None mentioned"}
                </div>
                <div className="draft-box" style={{ marginTop: 0 }}>
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>SENTIMENT (LAST CALL)</div>
                  {latestSummary?.sentiment ?? "—"}
                </div>
                <div className="draft-box" style={{ marginTop: 0, gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>WHERE THINGS STAND</div>
                  {latestSummary?.outcome ?? "No processed meetings yet."}
                </div>
              </div>
            )}
            {tab === "scoping" && (
              <div style={{ fontSize: 13 }}>
                {Object.keys(currentScoping).length === 0 && <p style={{ color: "var(--text-dim)" }}>No scoping data captured yet.</p>}
                {Object.entries(currentScoping).map(([field, row]: [string, any]) => (
                  <div key={field} className="draft-box" style={{ marginTop: 0, marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{field.toUpperCase().replace("_", " ")}</div>
                    <strong>{row.value}{row.unit ? ` ${row.unit}` : ""}</strong>
                    {row.context && <span style={{ color: "var(--text-dim)" }}> — {row.context}</span>}
                    {history.some((h) => h.field === field) && (
                      <div style={{ fontSize: 11, color: "var(--amber)", marginTop: 4 }}>
                        changed: previously {history.filter((h) => h.field === field).map((h) => h.value).join(" → ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {tab === "activity" && (
              <div style={{ fontSize: 13 }}>
                {interactions.length === 0 && <p style={{ color: "var(--text-dim)" }}>No activity yet.</p>}
                {interactions.map((i: any) => (
                  <Link key={i.id} href={`/meetings/${i.id}`}>
                    <div className="insight-item">
                      <strong>{i.title ?? "Meeting"}</strong>
                      <div className="src" style={{ color: "var(--text-dim)" }}>
                        {new Date(i.occurred_at).toLocaleString()}
                        {i.duration_s ? ` · ${Math.round(i.duration_s / 60)} min` : ""} · open meeting →
                      </div>
                    </div>
                  </Link>
                ))}
                <p style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 8 }}>Emails appear here when Gmail sync lands (Phase 2).</p>
              </div>
            )}
            {tab === "tasks" && (
              <div style={{ fontSize: 13 }}>
                {openTasks.length === 0 && <p style={{ color: "var(--text-dim)" }}>No action items captured yet.</p>}
                {openTasks.map((a: any) => (
                  <div key={a.id} className="draft-box" style={{ marginTop: 0, marginBottom: 8 }}>
                    {a.payload.description}
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                      {a.payload.owner_side === "us" ? "Square 9" : "Customer"}
                      {a.payload.owner_name ? ` · ${a.payload.owner_name}` : ""}
                      {a.payload.due_hint ? ` · ${a.payload.due_hint}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
