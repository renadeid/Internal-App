-- Forward-only campaign slug update guard.
-- Authenticated writers can insert a campaign slug and cannot update it.
-- Apply after 20261110102200_campaign_insert_requires_active_rows.sql.
-- This file does not edit an earlier migration.

revoke update (slug) on table public.campaigns from authenticated;
