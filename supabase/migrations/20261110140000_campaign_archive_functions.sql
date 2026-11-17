-- Forward-only privileged campaign archive and restore.
-- Authenticated clients cannot update campaigns.archived_at directly.
-- These functions are the only archive path. Apply after
-- 20261110110000_campaign_slug_update_revoked.sql.
-- This migration leaves earlier migrations and policies unchanged, but revokes direct UPDATE access to campaigns.archived_at.
--
-- The applying role becomes the owner of these SECURITY DEFINER functions.
-- public.campaigns and public.projects use FORCE ROW LEVEL SECURITY, so that
-- owner must be a superuser or have BYPASSRLS. Verify the owner on
-- company-hub-test before applying this migration. Do not change the owner
-- to authenticated.

create or replace function private.set_campaign_archived(
  target_campaign uuid,
  target_organization uuid,
  should_archive boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  campaign_row public.campaigns%rowtype;
  project_row public.projects%rowtype;
begin
  if auth.uid() is null then
    raise exception 'sign in is required' using errcode = '42501';
  end if;

  if should_archive is null then
    raise exception 'archive flag is required' using errcode = '22023';
  end if;

  select *
  into campaign_row
  from public.campaigns
  where id = target_campaign
  for update;

  if not found or campaign_row.organization_id is distinct from target_organization then
    raise exception 'Campaign not found' using errcode = 'P0002';
  end if;

  if not private.can_read_project(campaign_row.project_id) then
    raise exception 'Campaign not found' using errcode = 'P0002';
  end if;

  if not private.can_write_project(campaign_row.project_id) then
    raise exception 'not allowed to archive or restore this campaign' using errcode = '42501';
  end if;

  select *
  into project_row
  from public.projects as project
  where project.id = campaign_row.project_id
    and project.organization_id = campaign_row.organization_id
  for share;

  if not found then
    raise exception 'Campaign not found' using errcode = 'P0002';
  end if;

  if project_row.archived_at is not null then
    raise exception 'Restore this project before archiving or restoring this campaign'
      using errcode = 'P0001';
  end if;

  if should_archive then
    if campaign_row.archived_at is not null then
      return 'already_archived';
    end if;

    update public.campaigns
    set archived_at = pg_catalog.statement_timestamp()
    where id = campaign_row.id;

    return 'archived';
  end if;

  if campaign_row.archived_at is null then
    return 'already_active';
  end if;

  update public.campaigns
  set archived_at = null
  where id = campaign_row.id;

  return 'restored';
end;
$$;

create or replace function public.archive_campaign(
  target_campaign uuid,
  target_organization uuid
)
returns text
language sql
security definer
set search_path = ''
as $$
  select private.set_campaign_archived(target_campaign, target_organization, true);
$$;

create or replace function public.unarchive_campaign(
  target_campaign uuid,
  target_organization uuid
)
returns text
language sql
security definer
set search_path = ''
as $$
  select private.set_campaign_archived(target_campaign, target_organization, false);
$$;

revoke all on function private.set_campaign_archived(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.archive_campaign(uuid, uuid) from public, anon, authenticated;
revoke all on function public.unarchive_campaign(uuid, uuid) from public, anon, authenticated;

grant execute on function public.archive_campaign(uuid, uuid) to authenticated;
grant execute on function public.unarchive_campaign(uuid, uuid) to authenticated;
revoke update (archived_at) on table public.campaigns from authenticated;