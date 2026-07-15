-- Deals section fields. Run in Supabase SQL Editor after 004.

-- Stakeholder card fields (auto-filled by AI where possible, rep-editable always)
alter table attendee_profiles add column title text;
alter table attendee_profiles add column phone text;
alter table attendee_profiles add column location text;
alter table attendee_profiles add column sales_role text
  check (sales_role in ('champion', 'decision_maker', 'influencer', 'blocker', 'user', 'unknown'));

-- Company blurb on the deal
alter table deals add column company_location text;
alter table deals add column company_blurb text;
