# SalesSense Setup Checklist (Chris's to-do list)

Do these in order. Each takes a few minutes. Ask Claude if anything looks different than described.

## 1. Install GitHub Desktop
- Download from https://desktop.github.com and sign in with your GitHub account.
- File → Add local repository → choose `C:\Projects\SalesSense`.
- It will say "this isn't a repository" → click **Create a repository here** → Create.
- Click **Publish repository**. UNCHECK "keep this code private"? No — **keep it PRIVATE** (checked).

## 2. Run the database schema in Supabase
- Go to your Supabase project → **SQL Editor** → New query.
- Open `supabase/migrations/001_initial_schema.sql` from this folder (Notepad is fine), copy ALL of it, paste, click **Run**.
- Success looks like: "Success. No rows returned."

## 3. Connect Vercel to the GitHub repo
- vercel.com → Add New → Project → Import `salessense` from your GitHub.
- Framework preset should auto-detect **Next.js**. Don't change build settings.
- Before clicking Deploy, expand **Environment Variables** and add each variable
  listed in `.env.example` with its real value (next step tells you where each comes from).
- Click **Deploy**. In ~2 minutes you get a live URL showing the SalesSense placeholder page.

## 4. Collect your API keys (paste into Vercel env vars, and into a local `.env.local` copy)
| Variable | Where to find it |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Supabase → Project Settings → API → Project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase → Project Settings → API → anon public key |
| SUPABASE_SERVICE_ROLE_KEY | Supabase → Project Settings → API → service_role key (treat like a password) |
| RECALL_API_KEY | Recall.ai dashboard → API Keys |
| RECALL_BASE_URL | Shown in Recall dashboard (region URL, e.g. https://us-east-1.recall.ai) |
| ANTHROPIC_API_KEY | console.anthropic.com → API Keys → Create Key |
| WEBHOOK_SECRET | Make up a long random string (30+ characters) |

Also: copy `.env.example` to a new file named `.env.local` in this folder and fill in
the same values — that's what local development uses. It is git-ignored and never
leaves your machine.

## 5. Tell Claude "setup done"
Next milestone: send the bot to a real test meeting and watch a transcript land in the database.

## Rules that never change
- Secrets go in `.env.local` and Vercel's env settings — never in chat, never in GitHub.
- Commit + push via GitHub Desktop after each working session (Claude will remind you).
