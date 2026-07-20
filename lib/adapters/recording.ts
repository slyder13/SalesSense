// Recording adapter — the ONLY file that talks to Recall.ai.
// If we ever switch vendors (Skribby, MeetingBaaS, MS Graph), we rewrite this
// file and nothing else in the app changes.
// API reference: https://docs.recall.ai/reference/bot_create

export interface TranscriptSegment {
  speakerLabel: string;
  startMs: number;
  endMs: number;
  text: string;
}

const BASE = process.env.RECALL_BASE_URL!;
const KEY = process.env.RECALL_API_KEY!;

async function recall(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Token ${KEY}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) throw new Error(`Recall ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

// Send a bot to a meeting right now (used by the test page; auto-join covers real use)
export async function sendBotToMeeting(meetingUrl: string) {
  const { getOrgSettings } = await import("@/lib/org");
  const org = await getOrgSettings();
  return recall(`/api/v1/bot/`, {
    method: "POST",
    body: JSON.stringify({
      meeting_url: meetingUrl,
      bot_name: org.botName,
      recording_config: {
        transcript: {
          provider: {
            recallai_streaming: { mode: "prioritize_accuracy", language_code: "auto" },
          },
          diarization: { use_separate_streams_when_available: true },
        },
      },
      chat: {
        on_bot_join: {
          send_to: "everyone",
          message: org.disclosureMessage,
        },
      },
    }),
  });
}

export async function getBot(botId: string) {
  return recall(`/api/v1/bot/${botId}/`);
}

// Permanently deletes the bot's recorded media (audio/video) from Recall.
// Transcripts and insights already live in our database, so nothing user-facing is lost.
export async function deleteBotMedia(botId: string) {
  return recall(`/api/v1/bot/${botId}/delete_media/`, { method: "POST" });
}

// Summarize bot state for the UI
export function botStatus(bot: any): string {
  const changes = bot?.status_changes ?? [];
  return changes.length ? changes[changes.length - 1].code : "unknown";
}

// After the meeting: download the diarized transcript from media_shortcuts
export async function getTranscript(botId: string): Promise<TranscriptSegment[] | null> {
  const bot = await getBot(botId);
  const url = bot?.recordings?.[0]?.media_shortcuts?.transcript?.data?.download_url;
  if (!url) return null;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Transcript download → ${res.status}`);
  const data = await res.json();

  // Schema: array of utterances { participant: {name,...}, words: [{text, start_timestamp:{relative}, end_timestamp:{relative}}] }
  const segments: TranscriptSegment[] = [];
  for (const utt of data ?? []) {
    const words = utt.words ?? [];
    if (!words.length) continue;
    segments.push({
      speakerLabel: utt.participant?.name ?? "Unknown speaker",
      startMs: Math.round((words[0].start_timestamp?.relative ?? 0) * 1000),
      endMs: Math.round((words[words.length - 1].end_timestamp?.relative ?? 0) * 1000),
      text: words.map((w: any) => w.text).join(" "),
    });
  }
  return segments;
}
