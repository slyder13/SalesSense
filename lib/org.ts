import { supabaseAdmin } from "@/lib/supabase";

// Single-org for now (Square 9). When multi-tenancy goes live, callers pass
// the org id resolved from the signed-in user / bot metadata instead.
export const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

export interface OrgSettings {
  id: string;
  name: string;
  allowedDomains: string[];
  botName: string;
  disclosureMessage: string;
}

export async function getOrgSettings(orgId: string = DEFAULT_ORG_ID): Promise<OrgSettings> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("organizations")
    .select("id, name, allowed_domains, bot_name, disclosure_message")
    .eq("id", orgId)
    .single();
  if (error || !data) throw new Error(`Org not found: ${error?.message}`);
  return {
    id: data.id,
    name: data.name,
    allowedDomains: data.allowed_domains ?? [],
    botName: data.bot_name,
    disclosureMessage: data.disclosure_message,
  };
}
