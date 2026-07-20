-- Org-level settings (first step of removing hardcoded Square 9 values).
-- Run in Supabase SQL Editor after 009.

alter table organizations add column bot_name text not null default 'Square 9 Notetaker';
alter table organizations add column disclosure_message text not null
  default 'This meeting is being recorded and transcribed by Square 9 for note-taking purposes.';
