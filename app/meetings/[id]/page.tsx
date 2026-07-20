import { supabaseAdmin } from "@/lib/supabase";
import { currentAppUser, meetingVisibleTo } from "@/lib/authz";
import MeetingDetail from "@/components/MeetingDetail";

export const dynamic = "force-dynamic";

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = supabaseAdmin();

  const [{ data: meeting }, { data: segments }, { data: participants }, { data: insights }] =
    await Promise.all([
      db.from("interactions").select("id, title, occurred_at, duration_s, status, user_id, deals(id, name)").eq("id", id).single(),
      db.from("transcript_segments").select("id, speaker_label, start_ms, end_ms, text").eq("interaction_id", id).order("start_ms"),
      db.from("participants").select("name, talk_pct").eq("interaction_id", id).order("talk_pct", { ascending: false }),
      db.from("insights").select("id, kind, payload, segment_ids, created_at").eq("interaction_id", id).order("created_at", { ascending: false }),
    ]);

  if (!meeting) return <div className="card">Meeting not found.</div>;

  const user = await currentAppUser();
  if (!meetingVisibleTo(user, meeting.user_id)) {
    return <div className="card">Meeting not found.</div>;
  }

  // Latest of each kind (pipeline may have run more than once)
  const latest = (kind: string) => insights?.find((i) => i.kind === kind);
  const actionItems = insights?.filter((i) => i.kind === "action_item") ?? [];

  return (
    <MeetingDetail
      meeting={meeting}
      segments={segments ?? []}
      participants={participants ?? []}
      summary={latest("summary") ?? null}
      summaryId={latest("summary")?.id ?? null}
      actionItems={actionItems}
      emailDraft={latest("email_draft")?.payload ?? null}
      emailDraftId={latest("email_draft")?.id ?? null}
      crmNote={(latest("crm_note")?.payload as any)?.text ?? null}
      crmNoteId={latest("crm_note")?.id ?? null}
      debrief={latest("debrief") ?? null}
    />
  );
}
