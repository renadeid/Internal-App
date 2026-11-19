-- Run and commit before the permissions migration.
alter type public.org_role add value if not exists 'team_lead';
