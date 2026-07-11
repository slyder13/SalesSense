// Recording adapter — the ONLY file that talks to Recall.ai.
// If we ever switch vendors (Skribby, MeetingBaaS, MS Graph), we rewrite this
// file and nothing else in the app changes.

export interface RecordedMeeting {
  sourceRef: string; // vendor's id for this recording (Recall bot id)
  title: string | null;
  startedAt: string;
  durationS: number;
  audioUrl: string | null;
  participants: { name: string | null; email: string | null; speakerLabel: string }[];
  segments: { speakerLabel: string; startMs: number; endMs: number; text: string }[];
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

// Milestone 1: send a bot to a meeting URL manually (calendar auto-join comes next)
export async function sendBotToMeeting(meetingUrl: string, botName = "Square 9 Notetaker") {
  return recall(`/api/v1/bot/`, {
    method: "POST",
    body: JSON.stringify({
      meeting_url: meetingUrl,
      bot_name: botName,
      recording_config: {
        transcript: { provider: { meeting_captions: {} } },
      },
      chat: {
        on_bot_join: {
          send_to: "everyone",
          message:
            "This meeting is being recorded and transcribed by Square 9 for note-taking purposes.",
        },
      },
    }),
  });
}

export async function getBot(botId: string) {
  return recall(`/api/v1/bot/${botId}/`);
}
