import { supabaseAdmin } from "@/lib/supabase";
import DealDetail from "@/components/DealDetail";

export const dynamic = "force-dynamic";

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = supabaseAdmin();

  const [
    { data: deal },
    { data: stakeholders },
    { data: interactions },
    { data: scoping },
    { data: insights },
    { data: nextEvents },
  ] = await Promise.all([
    db.from("deals").select("*").eq("id", id).single(),
    db.from("attendee_profiles").select("*").eq("deal_id", id).order("updated_at", { ascending: false }),
    db.from("interactions").select("id, type, title, occurred_at, duration_s, status").eq("deal_id", id).order("occurred_at", { ascending: false }),
    db.from("deal_scoping").select("*").eq("deal_id", id).order("created_at", { ascending: false }),
    db.from("insights").select("id, interaction_id, kind, payload, created_at").eq("deal_id", id).order("created_at", { ascending: false }),
    db.from("calendar_events").select("title, start_time").gte("start_time", new Date().toISOString()).order("start_time").limit(50),
  ]);

  if (!deal) return <div className="card">Deal not found.</div>;

  // Best-effort: next meeting whose title matches this deal's meetings, else null
  const summaries = insights?.filter((i) => i.kind === "summary") ?? [];
  const latestSummary = summaries[0]?.payload as any;
  const actionItems = insights?.filter((i) => i.kind === "action_item") ?? [];
  const debriefs = insights?.filter((i) => i.kind === "debrief") ?? [];

  return (
    <DealDetail
      deal={deal}
      stakeholders={stakeholders ?? []}
      interactions={interactions ?? []}
      scoping={scoping ?? []}
      summaries={summaries}
      latestSummary={latestSummary ?? null}
      actionItems={actionItems}
      debriefs={debriefs}
      upcomingEvents={nextEvents ?? []}
    />
  );
}
