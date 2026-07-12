import Anthropic from "@anthropic-ai/sdk";
import {
  EXTRACTION_SYSTEM,
  buildExtractionUserMessage,
  PROMPT_VERSION,
} from "@/lib/prompts/meeting-extraction";

export const MODEL = "claude-sonnet-5";
export { PROMPT_VERSION };

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function extractMeetingIntelligence(
  segments: { idx: number; speaker: string; text: string }[]
) {
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: EXTRACTION_SYSTEM,
    messages: [{ role: "user", content: buildExtractionUserMessage(segments) }],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  // Model may wrap JSON in ```json fences — strip them
  const cleaned = text.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`AI returned unparseable JSON. First 200 chars: ${cleaned.slice(0, 200)}`);
  }
}
