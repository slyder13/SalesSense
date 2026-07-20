import { NextRequest, NextResponse } from "next/server";
import { currentAppUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabase";

// POST { userId, role } → admin changes a teammate's role
export async function POST(req: NextRequest) {
  try {
    const me = await currentAppUser();
    if (me?.role !== "admin") return NextResponse.json({ error: "admins only" }, { status: 403 });

    const { userId, role } = await req.json();
    if (!userId || !["rep", "manager", "admin"].includes(role)) {
      return NextResponse.json({ error: "invalid role" }, { status: 400 });
    }
    if (userId === me.id) {
      return NextResponse.json({ error: "you can't change your own role" }, { status: 400 });
    }

    const db = supabaseAdmin();
    const { error } = await db.from("users").update({ role }).eq("id", userId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
