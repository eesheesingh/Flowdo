# FlowDo

Find Your Flow. A productivity app for tasks, projects, and focus.

## Tech stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase (Postgres, Auth, RLS) via `@supabase/ssr`
- React Hook Form + Zod, TanStack Query
- Vitest + React Testing Library

## Architecture

All application data lives in a dedicated `flowdo` Postgres schema (not
`public`), with Row Level Security enabled on every table, enforced purely
via `auth.uid()`. Phase 1 covers project setup, the full database schema,
RLS, Supabase-native email/OTP authentication, protected routes, and a
dashboard shell. Phase 2 builds task and project management on top of that
foundation: Inbox/Today/Upcoming/Completed views, project CRUD and
archiving, search/filter/sort, and drag-and-drop ordering. See
`docs/superpowers/specs/` for the full design and `docs/superpowers/plans/`
for the implementation plan.

## Task & project management

Tasks and projects follow the same data-layer convention Phase 1 established
for auth: plain async functions in `lib/tasks/*.ts` and `lib/projects/*.ts`
(e.g. `createTask`, `updateTask`, `completeTask`, `reopenTask`, `listTasks`,
`createProject`, `archiveProject`) that take a Supabase client and do a
single typed operation — no Next.js Server Actions. Server Components call
them with the server client (`lib/supabase/server`); Client Components call
the same functions with the browser client (`lib/supabase/client`) from
inside TanStack Query mutations/queries in `components/tasks/task-view.tsx`.
All authorization is still enforced by RLS via `auth.uid()`, never by
trusting a `user_id`/`project_id` passed from the client.

Search, filter, and sort state lives entirely in the URL's query string
rather than component state. `lib/tasks/filter-params.ts`'s
`buildFullFilters` merges a view's fixed base filters (e.g. Inbox's
`projectId: null`, Today's `dueDate: "today"`) with the user-controlled
params parsed out of the query string (`status`, `priority`, `q`, `sort`,
`project`). Both Server Components (the `/app/inbox`, `/app/today`,
`/app/upcoming`, `/app/completed`, and project detail pages, reading
`searchParams`) and the Client Component `TaskView` (reading
`useSearchParams()`) call the same `buildFullFilters` function, so the
initial server-rendered list and the client-refetched list always agree,
and filters survive a page refresh or a shared link.

Drag-and-drop reordering does not rewrite every row's `position` on each
move. `lib/tasks/reorder.ts`'s `calculateNewPosition` computes a single new
position as the midpoint between the two tasks the dragged row now sits
between (or `±10` from an end when there's no neighbor on one side), so a
reorder is always exactly one row update.

## Local setup

1. `npm install`
2. Install the Supabase CLI (used via `npx supabase`) and Docker Desktop (must be running).
3. `npx supabase start` — starts local Postgres/Auth/Storage/Mailpit in Docker.
4. Copy `.env.example` to `.env.local` and fill in the values from `npx supabase status` for local development, or your hosted project's Settings → API for a real deployment.
5. `npx supabase db reset` — applies all migrations in `supabase/migrations/`.
6. `npm run dev` — starts the app at http://localhost:3000.

### Connecting to your hosted Supabase project

1. `npx supabase link --project-ref <your-project-ref>`
2. `npx supabase db push` — applies migrations to the hosted project.
3. **Manual step (cannot be done via CLI/migration):** in the Supabase dashboard, go to Project Settings → API → Data API Settings → Exposed schemas, and add `flowdo` to the list. Without this, PostgREST will not serve any `flowdo` table to the app.
4. **Manual step:** under Authentication → URL Configuration, set Site URL to your production domain and add `https://<your-domain>/**` to Redirect URLs. `supabase/config.toml`'s `additional_redirect_urls` only governs the local CLI stack and is never pushed to a hosted project — without this step, password reset breaks in production the same way it silently broke locally before this was fixed (the reset link redirects to your site's root instead of `/reset-password`).
5. Fill `.env.local` with the hosted project's URL, anon key, and service role key (Settings → API).

### Email delivery

Phase 1 uses Supabase's built-in auth email sending, sufficient for local
development and testing. For production, configure Resend SMTP under
Supabase Dashboard → Authentication → Emails → SMTP Settings, and set
`RESEND_API_KEY` in your environment (never in client-side code). Customize
the "Confirm signup" email template to surface `{{ .Token }}` so users see a
6-digit code rather than only a magic link.

## Environment variables

See `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY` must
never be referenced from Client Components or committed to source control.

## Running tests

- `npm test` — unit/component tests (no external dependencies).
- `npm run test:integration` — auth/RLS integration tests; requires `npx supabase start` running locally. These never touch a real/hosted Supabase project.

## Running verification

`npm run lint && npm run typecheck && npm test && npm run test:integration && npm run build`

## Security notes

- Every `flowdo` table has RLS enabled; policies check `auth.uid()` only, never a client-supplied id.
- No custom OTP table or password storage — Supabase Auth owns both.
- Password reset never reveals whether an email address has an account.
- OTP resend is cooldown-limited client-side and rate-limited by Supabase itself.

## Roadmap

Phase 3 (subtasks, labels, calendar, recurring tasks, notifications),
Phase 4 (analytics, realtime, project members), Phase 5 (AI features) each
get their own spec and plan once the prior phase is stable.

## Phase 2 status

Phase 2 (tasks, projects, search/filtering/sorting, drag-and-drop ordering)
is complete: full verification (`npm run lint`, `npm run typecheck`,
`npm test`, `npm run test:integration`, `npm run build`) passes. See
"Task & project management" above for the architecture.

Known flake: `tests/integration/profile.test.ts` occasionally fails when the
full integration suite runs with its default concurrency (it passes
reliably in isolation). This is pre-existing and out of scope for the
Phase 2 fix wave; if you see exactly that one failure, re-run
`npm run test:integration` to confirm it clears.
