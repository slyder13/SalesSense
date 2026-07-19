import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { getOpportunity } from "@/lib/adapters/salesforce";

// POST { dealId, opportunityId } → link a deal to a Salesforce opp and pull its fields
// POST { dealId, opportunityId: null } → unlink
export async function POST(req: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

    const { dealId, opportunityId } = await req.json();
    if (!dealId) return NextResponse.json({ error: "dealId required" }, { status: 400 });

    const db = supabaseAdmin();

    if (!opportunityId) {
      await db.from("deals").update({
        salesforce_opportunity_id: null, sf_stage: null, sf_amount: null,
        sf_close_date: null, sf_account_name: null, sf_synced_at: null,
      }).eq("id", dealId);
      return NextResponse.json({ ok: true, unlinked: true });
    }

    const opp = await getOpportunity(opportunityId);
    if (!opp) return NextResponse.json({ error: "opportunity not found" }, { status: 404 });

    const { error } = await db.from("deals").update({
      salesforce_opportunity_id: opp.Id,
      name: opp.Name, // deal takes the opp's name — single source of truth
      sf_stage: opp.StageName,
      sf_amount: opp.Amount,
      sf_close_date: opp.CloseDate,
      sf_account_name: opp.Account?.Name ?? null,
      sf_synced_at: new Date().toISOString(),
    }).eq("id", dealId);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, opp });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
