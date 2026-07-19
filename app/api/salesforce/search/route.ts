import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { searchOpportunities } from "@/lib/adapters/salesforce";

// GET ?q=term → search open Salesforce opportunities
export async function GET(req: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

    const q = req.nextUrl.searchParams.get("q") ?? "";
    if (q.length < 2) return NextResponse.json({ results: [] });

    const results = await searchOpportunities(q);
    return NextResponse.json({ results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
