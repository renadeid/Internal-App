export const knowledgeCategories = ["All guides", "People & roles", "Projects & tasks", "Assets & sharing"] as const
export const knowledgeGuides = [
 { id: "roles", category: "People & roles", title: "Who can do what?", summary: "Super admin, Admin, Owner (Team lead) and viewers.", steps: [
 "Super admin manages members, roles and project access, creates projects and can permanently delete projects.",
 "Admin views and edits existing organization work. Creating, deleting, archiving, restoring and changing permissions are unavailable.",
 "Owner (Team lead) creates, edits and assigns tasks in projects where they have full-history, non-viewer membership. Assignees must already belong to that project. Team leads cannot archive or delete tasks.",
 "Members can create projects only after a Team lead or Super admin enables Create project in Settings. Members see their own project and task tabs in People; colleagues’ profiles show the Overview only.",
 "External viewers open explicitly shared public links without an account. They see the shared snapshot only. The Viewer role in the members list is a separate, signed-in organization role.",
 ], href: "/people", linkLabel: "Open People & Onboarding" },
 { id: "new-member", category: "People & roles", title: "Give a new employee access", summary: "Organization membership and project access are separate steps.", steps: [
 "A Super admin creates an employee account or adds an existing account from Settings, then chooses the organization role.",
 "Open the project and use Project access to add the employee or send an in-app invitation. Choose full project history or assigned tasks only before granting access.",
 "For assigned-only invitations, choose tasks and either View only or View and update task status. Selected tasks are assigned after acceptance. The employee signs in and accepts from the banner, notifications menu or Settings. Pending invitations do not grant access.",
 "Department and all-employee selections include employees present when the project is created. New employees need a separate project grant. Invitations currently appear inside Roaya Connect; email delivery is not connected.",
 ], href: "/settings", linkLabel: "Open Settings" },
 { id: "history", category: "Projects & tasks", title: "Choose project history visibility", summary: "Full project history or only the tasks assigned to a member.", steps: [
 "Full project history shows project work available to that member. Editing and management capabilities still depend on their role and permissions.",
 "Assigned tasks only shows tasks currently assigned to that person, including older tasks. It hides other project work. View only is the default; a Super admin can explicitly allow updating the status of assigned tasks, without granting task editing or reassignment. Reassigning a task removes the previous assignee's task visibility under this mode.",
 "A Super admin can change this in Project access → Save member access. Super admins and Admins retain organization-wide access; project owners retain full history.",
 ], href: "/projects", linkLabel: "Open Projects" },
 { id: "assign", category: "Projects & tasks", title: "Create and assign a task", summary: "A practical workflow for Super admins and team leads.", steps: [
 "Open a saved, active project. Team leads need full-history, non-viewer membership in that project first.",
 "In Tasks, choose Create task. Enter the title, description, priority, status and due date, then select an assignee.",
 "The employee must already have project access. If they are missing from the list, ask a Super admin to grant access or send an invitation and wait for acceptance. Assignment does not invite anyone automatically.",
 "Use Edit to update or reassign existing tasks. Admins can edit existing tasks, but cannot create new ones.",
 ], href: "/projects", linkLabel: "Find a project" },
 { id: "archive", category: "Projects & tasks", title: "Archive or permanently delete a project", summary: "Choose whether the project needs to be recoverable.", steps: [
 "Archive keeps the project record and allows it to be restored later. Available actions depend on your project permissions; Admins cannot archive or restore work.",
 "Only a Super admin can use Delete project. Enter the exact project name before confirming permanent deletion.",
 "Deletion removes the project's tasks, campaigns, deliverables, invitations, memberships and project activity. Linked library assets and their files are kept. A deleted project cannot be restored.",
 ], href: "/projects", linkLabel: "Open Projects" },
 { id: "downloads", category: "Assets & sharing", title: "Find and download an asset", summary: "Find files in the library and download from their sources.", steps: [
 "Open Assets Library. All assets includes files inside every folder. Choose a department to see files owned by its members, or filter by file type and project.",
 "Choose View asset to read its details, or Download to retrieve an uploaded file. All projects lists projects you can access, including those without files.",
 "Use folders to organize files. Uploads support one file at a time from the library, or up to 25 files from a folder, with a 20 MB limit per file.",
 "The Assets Library stores files privately and shares them across devices. Company files are available to organization members. Project files require full project access; assigned-tasks-only access does not include project files. Download routes verify access before issuing short-lived links.",
 ], href: "/assets", linkLabel: "Open Assets Library" },
 { id: "public-links", category: "Assets & sharing", title: "Share outside the company", summary: "Create a view-only link that does not require sign-in.", steps: [
 "As Super admin, open a project or asset detail page and choose Share with external viewers. Review what will be shared, then create a public view-only link.",
 "Project links show a snapshot of the overview and active task titles, descriptions, statuses and due dates. Member identities, comments, campaigns and assets are excluded. Asset links show the name, description, type and source URL.",
 "Anyone with the link can view it without signing in. It expires after 7 days. Later edits require a new link because shared pages are snapshots.",
 "Use Revoke link on the original page to stop future access. This cannot retract copies or file URLs already obtained. Source files keep their own access rules.",
 "Localhost links only work on the same computer. To share with another device or person, use the publicly deployed address of Roaya Connect.",
 ], href: "/projects", linkLabel: "Choose a project" },
 { id: "create-project-permission", category: "Projects & tasks", title: "Enable project creation for a Member", summary: "Grant or revoke Create project without changing an employee’s role.", steps: ["Sign in as a Team lead or Super admin and open Settings.", "Under Project creation permissions, choose Manage access. Search by name or email, or filter by Allowed to create and Not allowed.", "Enable the switch beside the Member. Ask them to refresh their page, then choose Quick create or Create project from Projects.", "Turn the switch off to revoke future project creation. It does not remove access to existing projects. Changing an organization role clears any existing creation grant."], href: "/settings", linkLabel: "Manage permissions" },
 { id: "welcome-tour", category: "People & roles", title: "Find your way around Connect", summary: "Replay the welcome tour and find help whenever you need it.", steps: ["Open your profile menu and choose Replay welcome tour to revisit the guided introduction.", "The tour shows on the first dashboard visit. Finishing or skipping it saves that choice in this browser, so it does not repeat on every refresh.", "Use Ask Connect for help with the application, or browse the App guides here for step-by-step instructions."], href: "/", linkLabel: "Open Dashboard" },
 { id: "marketing-campaigns", category: "Projects & tasks", title: "Plan and find marketing campaigns", summary: "Browse campaign stages, owners and schedules in Marketing.", steps: ["Open Marketing from Department workspaces or Dashboard Quick access.", "Select Planning, Active, On Hold or Completed to filter campaigns. Search by name, owner or project and use the channel and project filters to narrow results.", "Open a campaign to see its details. If Create campaign is available, choose a project, owner, channel, dates and campaign brief.", "Show archived includes archived work. Campaigns and creation options depend on your existing project permissions."], href: "/workspaces/marketing", linkLabel: "Open Marketing" },
] as const
