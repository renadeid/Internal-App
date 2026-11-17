-- Forward-only campaign insert guard.
-- An authenticated insert is allowed only when the new campaign is active and
-- its parent project is active. Apply after
-- 20261110100200_campaign_update_requires_active_rows.sql.
-- This file does not edit an earlier migration.

revoke insert on table public.campaigns from authenticated;

grant insert (
  id,
  organization_id,
  project_id,
  slug,
  name,
  description,
  goals,
  owner_id,
  type,
  status,
  starts_on,
  ends_on
) on table public.campaigns to authenticated;

drop policy campaigns_insert on public.campaigns;

create policy campaigns_insert on public.campaigns
  for insert to authenticated
  with check (private.campaign_row_is_editable(project_id, archived_at));
