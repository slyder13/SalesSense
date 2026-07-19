import Anthropic from "@anthropic-ai/sdk";
import {
  EXTRACTION_SYSTEM,
  buildExtractionUserMessage,
  PROMPT_VERSION,
} from "@/lib/prompts/meeting-extraction";
import {
  DRAFTS_SYSTEM,
  buildDraftsUserMessage,
  DRAFTS_PROMPT_VERSION,
} from "@/lib/prompts/drafts";
import {
  DEBRIEF_SYSTEM,
  buildDebriefUserMessage,
  DEBRIEF_PROMPT_VERSION,
} from "@/lib/prompts/debrief";

export const MODEL = "claude-sonnet-5";
export { PROMPT_VERSION, DRAFTS_PROMPT_VERSION, DEBRIEF_PROMPT_VERSION };

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function parseJsonResponse(msg: Anthropic.Message) {
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const cleaned = text.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`AI returned unparseable JSON. First 200 chars: ${cleaned.slice(0, 200)}`);
  }
}

export async function extractMeetingIntelligence(
  segments: { idx: number; speaker: string; text: string }[]
) {
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: EXTRACTION_SYSTEM,
    messages: [{ role: "user", content: buildExtractionUserMessage(segments) }],
  });

  return parseJsonResponse(msg);
}

export async function generateDrafts(input: {
  repName: string;
  extracted: any;
  priorMeetings?: any[];
}) {
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: DRAFTS_SYSTEM,
    messages: [{ role: "user", content: buildDraftsUserMessage(input) }],
  });
  return parseJsonResponse(msg);
}

export async function generateDebrief(
  segments: { idx: number; speaker: string; text: string }[]
) {
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: DEBRIEF_SYSTEM,
    messages: [{ role: "user", content: buildDebriefUserMessage(segments) }],
  });
  return parseJsonResponse(msg);
}
