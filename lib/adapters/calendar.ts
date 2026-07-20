// Calendar adapter — the ONLY file that talks to Recall's Calendar V2 API
// and Google's OAuth token endpoint.

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

// ---------- Google OAuth ----------

export function googleAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    redirect_uri: `${process.env.APP_URL}/api/calendar/callback`,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/calendar.events.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "),
    access_type: "offline", // gives us a refresh token
    prompt: "consent",      // forces refresh token even on re-connect
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleCode(code: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${process.env.APP_URL}/api/calendar/callback`,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google token exchange failed: ${JSON.stringify(data)}`);
  return data as { refresh_token?: string; access_token: string; id_token?: string };
}

// ---------- Recall Calendar V2 ----------

export async function createRecallCalendar(refreshToken: string) {
  return recall(`/api/v2/calendars/`, {
    method: "POST",
    body: JSON.stringify({
      platform: "google_calendar",
      oauth_client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      oauth_client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      oauth_refresh_token: refreshToken,
    }),
  });
}

export async function listUpcomingEvents(calendarId: string) {
  const now = new Date().toISOString();
  const data = await recall(
    `/api/v2/calendar-events/?calendar_id=${calendarId}&start_time__gte=${encodeURIComponent(now)}`
  );
  return data.results ?? [];
}

// Schedule (or reschedule) a bot for a calendar event
export async function scheduleBotForEvent(eventId: string, botConfig: any, dedupKey: string) {
  return recall(`/api/v2/calendar-events/${eventId}/bot/`, {
    method: "POST",
    body: JSON.stringify({ deduplication_key: dedupKey, bot_config: botConfig }),
  });
}

export async function unscheduleBotForEvent(eventId: string) {
  return recall(`/api/v2/calendar-events/${eventId}/bot/`, { method: "DELETE" });
}

// The standard SalesSense bot config for scheduled meetings.
// Bot name + disclosure come from org settings (Admin section).
export function standardBotConfig(
  meta: Record<string, string>,
  org: { botName: string; disclosureMessage: string }
) {
  return {
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
    metadata: meta,
  };
}
