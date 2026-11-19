-- Add the role in its own migration so PostgreSQL commits the enum value before use.
alter type public.org_role add value if not exists 'admin';
