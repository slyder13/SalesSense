-- Hardening pass. Run in Supabase SQL Editor after 008.

-- Track when we've deleted the recording media from Recall (retention policy)
alter table interactions add column media_deleted_at timestamptz;

-- Reminder (manual step, not SQL): promote yourself in Table Editor →
-- users → your row → role = 'admin' so you can see all meetings.
