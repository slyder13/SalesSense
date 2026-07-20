import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { currentAppUser, canSeeAllMeetings } from "@/lib/authz";
import AutoRefresh from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const user = await currentAppUser();
  const db = supabaseAdmin();

  let query = db
    .from("interactions")
    .select("id, title, occurred_at, duration_s, status, failure_reason, user_id, deals(name), insights(kind)")
    .eq("type", "meeting")
    .order("occurred_at", { ascending: false })
    .limit(50);

  // Reps see their own meetings (plus unowned ones); managers/admins see all
  if (!canSeeAllMeetings(user)) {
    query = query.or(`user_id.eq.${user?.id ?? "00000000-0000-0000-0000-000000000000"},user_id.is.null`);
  }
  const { data: meetings } = await query;

  return (
    <div>
      <AutoRefresh seconds={30} />
      <div className="page-title">Meetings</div>
      <div className="page-sub">
        Every captured call, newest first. New meetings appear automatically a few minutes after they end.
      </div>

      {(meetings ?? []).length === 0 && (
        <div className="card">No meetings yet. Send the bot to one from the test page.</div>
      )}

      {(meetings ?? []).map((m: any) => {
        const enriched = m.insights?.some((i: any) => i.kind === "summary");
        const badge =
          m.status === "failed" ? (
            <span className="badge failed">failed</span>
          ) : enriched ? (
            <span className="badge ready">ready</span>
          ) : (
            <span className="badge processing">processing</span>
          );
        const mins = m.duration_s ? Math.round(m.duration_s / 60) : null;
        return (
          <Link key={m.id} href={`/meetings/${m.id}`}>
            <div className="meeting-row">
              <div>
                <div className="title">{m.title ?? "Meeting"}</div>
                <div className="meta">
                  {new Date(m.occurred_at).toLocaleString()}
                  {mins !== null && ` · ${mins} min`}
                  {m.deals?.name && ` · ${m.deals.name}`}
                  {m.failure_reason && ` · ${m.failure_reason}`}
                </div>
              </div>
              {badge}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
