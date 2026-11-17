-- Forward-only campaign update guard.
-- An authenticated writer can update a campaign only when the campaign and its
-- parent project are both active. Archive and unarchive are not client updates.
-- Apply after 20261104170100_authorization.sql. This file does not edit that migration.

create or replace function private.campaign_row_is_editable(
  target_project uuid,
  target_archived_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_write_project(target_project)
    and target_archived_at is null
    and exists (
      select 1
      from public.projects as project
      where project.id = target_project
        and project.archived_at is null
    );
$$;

revoke all on function private.campaign_row_is_editable(uuid, timestamptz) from public;
grant execute on function private.campaign_row_is_editable(uuid, timestamptz) to authenticated;

drop policy campaigns_update on public.campaigns;

create policy campaigns_update on public.campaigns
  for update to authenticated
  using (private.campaign_row_is_editable(project_id, archived_at))
  with check (private.campaign_row_is_editable(project_id, archived_at));
