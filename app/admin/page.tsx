import { supabaseAdmin } from "@/lib/supabase";
import { currentAppUser } from "@/lib/authz";
import { getOrgSettings } from "@/lib/org";
import AdminPanel from "@/components/AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await currentAppUser();
  if (user?.role !== "admin") {
    return <div className="card">Page not found.</div>;
  }

  const db = supabaseAdmin();
  const [{ data: users }, org] = await Promise.all([
    db.from("users")
      .select("id, email, name, role, recall_calendar_id, created_at")
      .order("created_at"),
    getOrgSettings(),
  ]);

  return <AdminPanel users={users ?? []} org={org} currentUserId={user.id} />;
}
