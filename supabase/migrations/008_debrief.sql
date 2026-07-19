-- Allow the new 'debrief' insight kind. Run in Supabase SQL Editor after 007.

alter table insights drop constraint insights_kind_check;
alter table insights add constraint insights_kind_check check (kind in
  ('summary', 'action_item', 'email_draft', 'crm_note', 'deal_rollup', 'signal', 'score', 'debrief'));
