"use client";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

const ALLOWED_DOMAIN = "square-9.com";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const params = useSearchParams();

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const clean = email.trim().toLowerCase();
    if (!clean.endsWith(`@${ALLOWED_DOMAIN}`)) {
      setError(`Only ${ALLOWED_DOMAIN} email addresses can sign in.`);
      return;
    }
    setBusy(true);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
      email: clean,
      options: { emailRedirectTo: `${location.origin}/auth/confirm` },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div style={{ maxWidth: 380, margin: "12vh auto", padding: "0 1rem" }}>
      <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>
        Sales<span style={{ color: "var(--accent)" }}>Sense</span>
      </div>
      <p style={{ color: "var(--text-dim)", marginBottom: 24 }}>
        Sign in with your Square 9 email — we'll send you a login link.
      </p>

      {params.get("error") === "domain" && (
        <div className="card" style={{ borderColor: "var(--red)" }}>
          That account isn't a Square 9 email address.
        </div>
      )}

      {sent ? (
        <div className="card">
          <strong>Check your email.</strong>
          <p style={{ marginTop: 6 }}>
            We sent a sign-in link to {email}. Click it and you'll land in SalesSense.
          </p>
        </div>
      ) : (
        <form onSubmit={sendLink}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@square-9.com"
            style={{
              width: "100%", padding: "11px 12px", fontSize: 14,
              border: "1px solid var(--border)", borderRadius: 8, marginBottom: 12,
            }}
          />
          <button className="btn" type="submit" disabled={busy} style={{ width: "100%" }}>
            {busy ? "Sending..." : "Send sign-in link"}
          </button>
          {error && <p style={{ color: "var(--red)", marginTop: 10 }}>{error}</p>}
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
