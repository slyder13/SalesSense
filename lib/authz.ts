import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";

export interface AppUser {
  id: string;
  email: string;
  role: "rep" | "manager" | "admin";
  orgId: string;
}

// The signed-in user's app record (role drives what they can see)
export async function currentAppUser(): Promise<AppUser | null> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const db = supabaseAdmin();
  const { data } = await db
    .from("users").select("id, email, role, org_id").eq("email", user.email).maybeSingle();
  if (!data) return null;
  return { id: data.id, email: data.email, role: data.role, orgId: data.org_id };
}

export function canSeeAllMeetings(user: AppUser | null) {
  return user?.role === "manager" || user?.role === "admin";
}

// Visibility rule (PRD): reps see their own meetings; managers/admins see all.
// Meetings with no owner (older test meetings, manual bots) stay visible to everyone
// on the team rather than disappearing.
export function meetingVisibleTo(user: AppUser | null, meetingUserId: string | null) {
  if (!user) return false;
  if (canSeeAllMeetings(user)) return true;
  return meetingUserId === null || meetingUserId === user.id;
}
