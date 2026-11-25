# Department requests

Apply `supabase/migrations/20261125190000_department_requests.sql` to the deployed database before deploying the page.

Members, team leads and Super admins can send requests. Admins and viewers cannot send requests. Senders see their own requests. Super admins see the organization inbox; team leads see requests addressed to departments in which they hold the manager membership. A team lead without a department manager membership has no inbox access.

Only a department's authorized reviewer can accept or decline its requests. Accepting requires an active project linked to that department, full existing task-creation access, and an existing project member who can submit work. No memberships, project permissions or invitation permissions are granted. The request row is locked before creating a task, so concurrent decisions cannot create duplicate tasks. A sender can cancel only before triage. Declining requires a reason.

The brief, priority, requested due date and optional HTTPS reference link become the task's initial details. Reference files are linked from a shared folder; request intake does not upload separate attachments. Submission uploads and revisions use the existing task delivery workflow.

Senders see task progress and the latest approved result only when the task is Done and its current assignee submitted that revision. Draft and pending submissions are not returned. An authenticated download route checks membership and request ownership/department reviewer access before issuing a 60-second URL from the private task-submissions bucket. Linking a request does not grant access to other project tasks or earlier submissions. A task link is shown only when the viewer already has task access.

The page supports Sent by me, Department inbox, search, department/status filters, six requests per page and manual refresh. It does not send email or grant extra project access. Database assertions in `supabase/tests/department_requests.sql` run in a transaction and roll back all test data; they use the existing Security Org A test actors and Workflow Check project.
