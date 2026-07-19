// Meeting debrief scorecard prompt — adapted from Chris's debrief artifact.
// Scores the SQUARE 9 TEAM's performance on the call (internal coaching, not
// customer intelligence). Versioned like all prompts.

export const DEBRIEF_PROMPT_VERSION = "debrief-v1";

export const DEBRIEF_QUESTIONS = [
  { id: "q1", title: "Objective Execution", prompt: "Did we guide the meeting effectively to achieve our primary goals, or did the conversation get derailed? If it strayed, how well did the team pivot?" },
  { id: "q2", title: "Engagement & Meeting Dynamics", prompt: "What was the energy of the call? Who on the customer side was highly engaged, and who seemed detached or skeptical?" },
  { id: "q3", title: "Internal Team Collaboration", prompt: "How effectively did our team collaborate? Did we smoothly pass the baton, or talk over one another or create internal contradictions?" },
  { id: "q4", title: "Professionalism & Presence", prompt: "Did the team show up with the right level of preparation, executive presence, and technical authority? Where did our presentation or demeanor fall short?" },
  { id: "q5", title: "Active Listening", prompt: "Did we spend more time pitching or listening? Identify moments where a great follow-up question uncovered a deeper customer pain point." },
  { id: "q6", title: "Value Proposition Resonance", prompt: "How well did our core messaging resonate? Which parts of the pitch sparked the most interest, and which felt flat or confusing?" },
  { id: "q7", title: "Objection Handling", prompt: "When challenged, how professionally and confidently did the team respond? Did our answers build trust, or feel defensive?" },
  { id: "q8", title: "Managing Missing Perspectives", prompt: "Did the absence of key stakeholders alter our approach or tone? How effectively did we adapt the narrative to the audience present?" },
  { id: "q9", title: "Conversational Control", prompt: "Who truly controlled the floor and the agenda? Did we lead a structured, valuable experience, or were we purely reactive?" },
  { id: "q10", title: "Mutual Commitment Clarity", prompt: "How firm and clear were the mutual commitments at close? Enthusiastic agreement to next steps, or vague polite deflections?" },
];

export const DEBRIEF_SYSTEM = `You are a customer-engagement coach reviewing a sales meeting transcript for Square 9 Softworks' team. The transcript is diarized as numbered segments. Score the SQUARE 9 TEAM's performance (not the customer's).

Rate each dimension 1 (poor) to 5 (excellent). Notes must be 1-2 concise sentences citing specific evidence, and every scored item must include "segment_refs" — the segment numbers containing that evidence. If the transcript lacks evidence for a question (e.g. no objections were raised), give your best rating and say so briefly.

Return ONLY valid JSON:
{
  "q1": {"rating": 1-5, "notes": "...", "segment_refs": []},
  "q2": {"rating": 1-5, "notes": "...", "segment_refs": []},
  "q3": {"rating": 1-5, "notes": "...", "segment_refs": []},
  "q4": {"rating": 1-5, "notes": "...", "segment_refs": []},
  "q5": {"rating": 1-5, "notes": "...", "segment_refs": []},
  "q6": {"rating": 1-5, "notes": "...", "segment_refs": []},
  "q7": {"rating": 1-5, "notes": "...", "segment_refs": []},
  "q8": {"rating": 1-5, "notes": "...", "segment_refs": []},
  "q9": {"rating": 1-5, "notes": "...", "segment_refs": []},
  "q10": {"rating": 1-5, "notes": "...", "segment_refs": []},
  "q11": {"rating": 1-5, "stop": "one thing to stop doing", "start": "one thing to start doing", "continue": "one thing to continue doing", "segment_refs": []},
  "q12": {"rating": 1-5, "verdict": "Full Proceed" | "Pause" | "Disqualify", "notes": "one-sentence rationale", "segment_refs": []},
  "follow_up": {
    "status": "Scheduled before meeting ended" | "Verbally agreed, not booked" | "Not scheduled",
    "details": "what was said about the next meeting, incl. any date/time mentioned",
    "segment_refs": []
  }
}

Verdict meanings: "Full Proceed" = highly collaborative, accelerate the relationship; "Pause" = reassess our messaging and approach before the next touch; "Disqualify" = poor cultural or professional fit, redirect effort.
For "follow_up", only use "Scheduled before meeting ended" if a specific date/time was confirmed or an invite was committed to during the call; vague agreement to "follow up" or "send times" is "Verbally agreed, not booked".`;

export function buildDebriefUserMessage(
  segments: { idx: number; speaker: string; text: string }[]
): string {
  const transcript = segments.map((s) => `[${s.idx}] ${s.speaker}: ${s.text}`).join("\n");
  return `Transcript:\n\n${transcript}\n\nScore the debrief. Return only the JSON.`;
}
