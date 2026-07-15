import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import AutoRefresh from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const db = supabaseAdmin();
  const { data: deals } = await db
    .from("deals")
    .select("id, name, company_domain, status, salesforce_opportunity_id, interactions(id, occurred_at)")
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(100);

  const sorted = (deals ?? [])
    .map((d: any) => {
      const dates = (d.interactions ?? []).map((i: any) => +new Date(i.occurred_at));
      return { ...d, meetings: d.interactions?.length ?? 0, lastTouch: dates.length ? Math.max(...dates) : 0 };
    })
    .sort((a: any, b: any) => b.lastTouch - a.lastTouch);

  return (
    <div>
      <AutoRefresh seconds={60} />
      <div className="page-title">Deals</div>
      <div className="page-sub">
        Auto-created from meeting attendees' company domains. Salesforce linking comes next.
      </div>

      {sorted.length === 0 && (
        <div className="card">No deals yet — they appear automatically when meetings are processed.</div>
      )}

      {sorted.map((d: any) => (
        <Link key={d.id} href={`/deals/${d.id}`}>
          <div className="meeting-row">
            <div>
              <div className="title">{d.name}</div>
              <div className="meta">
                {d.company_domain ?? "no domain"} · {d.meetings} meeting{d.meetings === 1 ? "" : "s"}
                {d.lastTouch ? ` · last touch ${new Date(d.lastTouch).toLocaleDateString()}` : ""}
                {d.salesforce_opportunity_id ? " · linked to Salesforce" : ""}
              </div>
            </div>
            <span className={`badge ${d.status === "open" ? "ready" : "processing"}`}>{d.status}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
