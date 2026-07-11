# SalesSense

Sales Intelligence platform for Square 9. Captures sales meetings (Teams/Zoom/Meet via Recall.ai bot), transcribes them, and extracts summaries, action items, attendee-level insights, talk-time stats, and project scoping data — organized by deal.

## Stack

- **Next.js** (web app) — hosted on Vercel
- **Supabase** (Postgres + auth + storage)
- **Recall.ai** (meeting bot + transcription)
- **Claude API** (AI extraction)

## Project layout

```
app/                  Next.js pages and API routes
lib/                  Shared code (Supabase client, vendor adapters)
lib/adapters/         Thin wrappers around vendors so they're swappable
supabase/migrations/  Database schema (run in Supabase SQL editor)
Documents/            Product docs (PRD, roadmap)
```

## Setup

See `SETUP.md` for the step-by-step checklist.

Secrets live in `.env.local` (never committed — see `.env.example` for the list).
