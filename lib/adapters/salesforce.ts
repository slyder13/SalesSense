// Salesforce adapter — the ONLY file that talks to Salesforce.
// OAuth 2.0 web server flow with PKCE; REST API for queries.

import { supabaseAdmin } from "@/lib/supabase";
import crypto from "crypto";

const LOGIN_URL = process.env.SALESFORCE_LOGIN_URL ?? "https://login.salesforce.com";
const API_VERSION = "v61.0";
const SQUARE9_ORG = "00000000-0000-0000-0000-000000000001";

// ---------- OAuth ----------

export function pkcePair() {
  const verifier = crypto.randomBytes(48).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function sfAuthUrl(state: string, codeChallenge: string) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SALESFORCE_CLIENT_ID!,
    redirect_uri: `${process.env.APP_URL}/api/salesforce/callback`,
    scope: "api refresh_token",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${LOGIN_URL}/services/oauth2/authorize?${params}`;
}

export async function exchangeSfCode(code: string, codeVerifier: string) {
  const res = await fetch(`${LOGIN_URL}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.SALESFORCE_CLIENT_ID!,
      client_secret: process.env.SALESFORCE_CLIENT_SECRET!,
      redirect_uri: `${process.env.APP_URL}/api/salesforce/callback`,
      code,
      code_verifier: codeVerifier,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`SF token exchange failed: ${JSON.stringify(data)}`);
  return data as { access_token: string; refresh_token: string; instance_url: string };
}

// ---------- Access token from stored refresh token ----------

async function getConnection() {
  const db = supabaseAdmin();
  const { data } = await db
    .from("salesforce_connections").select("*").eq("org_id", SQUARE9_ORG).maybeSingle();
  if (!data) throw new Error("Salesforce is not connected — connect it in Settings first");
  return data;
}

async function accessToken() {
  const conn = await getConnection();
  const res = await fetch(`${LOGIN_URL}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.SALESFORCE_CLIENT_ID!,
      client_secret: process.env.SALESFORCE_CLIENT_SECRET!,
      refresh_token: conn.refresh_token,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`SF token refresh failed: ${JSON.stringify(data)}`);
  return { token: data.access_token as string, instanceUrl: conn.instance_url as string };
}

async function sfQuery(soql: string) {
  const { token, instanceUrl } = await accessToken();
  const res = await fetch(
    `${instanceUrl}/services/data/${API_VERSION}/query?q=${encodeURIComponent(soql)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`SF query failed: ${JSON.stringify(data)}`);
  return data.records ?? [];
}

// ---------- Opportunity operations ----------

export interface SfOpportunity {
  Id: string;
  Name: string;
  StageName: string;
  Amount: number | null;
  CloseDate: string | null;
  Account?: { Name: string };
}

export async function searchOpportunities(term: string): Promise<SfOpportunity[]> {
  // SOQL LIKE-injection guard: strip quotes and backslashes
  const safe = term.replace(/['"\\%_]/g, "").trim();
  if (!safe) return [];
  return sfQuery(
    `SELECT Id, Name, StageName, Amount, CloseDate, Account.Name
     FROM Opportunity
     WHERE (Name LIKE '%${safe}%' OR Account.Name LIKE '%${safe}%') AND IsClosed = false
     ORDER BY LastModifiedDate DESC LIMIT 10`
  );
}

export async function getOpportunity(id: string): Promise<SfOpportunity | null> {
  const safe = id.replace(/[^a-zA-Z0-9]/g, "");
  const records = await sfQuery(
    `SELECT Id, Name, StageName, Amount, CloseDate, Account.Name
     FROM Opportunity WHERE Id = '${safe}' LIMIT 1`
  );
  return records[0] ?? null;
}
