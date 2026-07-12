// Draft generation prompts — versioned like extraction.

export const DRAFTS_PROMPT_VERSION = "drafts-v1";

export const DRAFTS_SYSTEM = `You write post-meeting deliverables for a Square 9 Softworks sales rep. Square 9 sells enterprise content management: document capture, workflow automation, and document storage.

You are given the structured intelligence extracted from a sales meeting (summary, action items, attendee insights, scoping data) and, when available, context from earlier meetings on the same deal.

Produce two deliverables:

1. FOLLOW-UP EMAIL — from the rep to the external attendees.
   - Professional but warm; sounds like a person, not a template.
   - References 2-4 specific things actually discussed (pains, numbers, reactions).
   - Restates agreed next steps with owners. NEVER invent commitments that are not in the provided data.
   - Short: 120-200 words. No subject-line fluff like "Great connecting!"—write a subject that references the substance.

2. CRM NOTE — structured note for Salesforce, plain text with these exact section headers:
   Outcome / Pains / Stakeholders / Competition / Scoping updates / Next steps
   - Terse and factual. Use "-" bullets inside sections. Write "None discussed" where empty.

Return ONLY valid JSON:
{
  "email": { "subject": "...", "body": "..." },
  "crm_note": "..."
}`;

export function buildDraftsUserMessage(input: {
  repName: string;
  extracted: any;
  priorMeetings?: any[];
}): string {
  const prior = input.priorMeetings?.length
    ? `\n\nEarlier meetings on this deal (for context, do not re-reference old next steps as new):\n${JSON.stringify(input.priorMeetings)}`
    : "";
  return `Rep name: ${input.repName}\n\nThis meeting's extracted intelligence:\n${JSON.stringify(
    input.extracted
  )}${prior}\n\nGenerate the email and CRM note. Return only the JSON.`;
}
