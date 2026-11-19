# External viewers

Super admins can publish a read-only snapshot from a project or asset detail page. Anyone holding the generated random 256-bit link can open it without an account. This does not create an organization member or change the existing Viewer membership role.

Projects share their name, description, status, due date and current active task titles, descriptions, statuses and due dates. No member identities, campaigns, comments, private files or workspace navigation are published. Assets share only the previewed name, description, type and source URL. The current Assets Library is browser-local; publishing persists that selected snapshot to Supabase. Source file permissions are unchanged.

Links expire in seven days and can be revoked on the original detail page. They are snapshots: later edits require a new link. Deleting or archiving a project makes its links unavailable. Revocation cannot retract copies or source URLs already obtained by a viewer.

Apply `20261119170000_public_viewer_links.sql` in Supabase. Share `/share/<token>` links from a publicly deployed app URL; localhost is accessible only on the same computer. The public endpoint uses the anonymous key, with access only to a token-scoped SQL function; private tables remain protected. Responses are not cached or indexed and send no referrer to external sources.
