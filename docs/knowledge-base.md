# Company knowledge base

Knowledge base combines organization articles with built-in application guides. Categories are Getting started, Company policies, Department guides and App guides. No company policies are seeded or invented.

Apply `20261125150000_knowledge_articles.sql` before deployment. It was applied to the live application's company-hub-test database on 25 November 2026.

Super admins and Team leads create/edit company articles, save drafts, publish, and archive/restore through the editor. Members, Viewers and Admins can read published articles in their own workspace. Drafts and archived articles are editor-only. RLS enforces this on direct database requests too. Editing requires the expected update timestamp to prevent overwriting concurrent changes. Author and timestamps are stamped by the database; workspace reassignment and hard deletion are unavailable.

Articles contain plain text with paragraph breaks, a summary, category, optional department (required for Department guides), and an optional HTTPS resource link. Links retain their source's permissions. Files can be uploaded in Assets and linked from an article. Built-in App guides remain maintained in source code, are read-only in the editor, and feed Ask Connect. Company article contents are not sent to the external AI assistant.

The library searches titles, summaries, article content, authors and departments; supports category, department, status and sort filters; and shows six results per page. Reading and editing open accessible dialogs.

Validation: 21 tests for input validation, URL restrictions, write authorization, tenant-scoped updates and concurrent edits; TypeScript and ESLint. Live SQL tests validated Team lead creation, Member published-only reads, denied Member/Admin writes, outsider isolation and Super admin updates with author stamping. All database test changes were rolled back.
