# Deploying Roaya Connect

Production: https://roaya-connect.vercel.app

Vercel project: `re-5fcb/roaya-connect`. Published from the current local source on 2026-11-19. Anonymous checks passed for sign-in (200), logo (200), protected workspace redirects (307), and invalid public-share token (404). Authenticated production workflows still need a user sign-in check.

The application requires a Next.js server; a static HTML upload cannot run authentication, Server Actions or public-share routes.

## Vercel

Use this application directory as the project root. `vercel.json` selects the Next.js framework and the locally verified webpack production build. `postcss.config.mjs` enables Tailwind utility generation for that build as well as development. `.vercelignore` excludes local credentials, database review material and backups from CLI uploads; directory exclusions are root-anchored so application modules in `src/lib/supabase` remain included.

Set these environment variables for Production before building:

- `NEXT_PUBLIC_SUPABASE_URL`: the Supabase project origin, without a dashboard path.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the publishable/anon key.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only; required for Super admin Create user. Never use a `NEXT_PUBLIC_` prefix for this key.

Use the existing Supabase project to preserve current data. Configure values privately in Vercel; never commit `.env.local`. Deploy the current local source, since uncommitted feature changes are not included in a GitHub import.

After deployment, verify the production URL redirects signed-out visitors to sign-in, then test sign-in and project access with an existing account. Configure the final HTTPS origin as the Supabase Auth Site URL when adopting this as the production site; keep only intentionally supported redirect URLs. Public sharing links created on the hosted application must use the hosted origin.

Assets Library preview records currently live in each browser's local storage. They do not automatically transfer from localhost to the hosted URL or between users. This feature requires separate shared persistence work for organisation-wide asset records.

A public deployment URL does not remove application authentication or grant project membership. Existing public viewer links remain separately controlled by their expiry and revocation.
