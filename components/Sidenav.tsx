"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function Sidenav() {
  const path = usePathname();
  const router = useRouter();

  // No nav chrome on auth screens
  if (path.startsWith("/login") || path.startsWith("/auth")) return null;

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="sidenav">
      <div className="brand">
        Sales<span>Sense</span>
      </div>
      <Link href="/meetings" className={path.startsWith("/meetings") ? "active" : ""}>
        Meetings
      </Link>
      <div className="nav-disabled">Deals <small>SOON</small></div>
      <div className="nav-disabled">Search <small>SOON</small></div>
      <div className="nav-disabled">Analytics <small>SOON</small></div>
      <Link href="/settings" className={path.startsWith("/settings") ? "active" : ""}>
        Settings
      </Link>
      <div style={{ flex: 1 }} />
      <Link href="/test">Bot test page</Link>
      <a onClick={signOut} style={{ cursor: "pointer" }}>Sign out</a>
    </nav>
  );
}
