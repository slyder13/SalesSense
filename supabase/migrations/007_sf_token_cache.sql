-- Cache the short-lived Salesforce access token so we don't refresh on every
-- API call (refresh token rotation makes concurrent refreshes fail).
-- Run in Supabase SQL Editor after 006.

alter table salesforce_connections add column access_token text;
alter table salesforce_connections add column access_token_expires_at timestamptz;
