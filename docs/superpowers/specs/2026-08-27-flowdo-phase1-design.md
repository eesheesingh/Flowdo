# FlowDo — Phase 1 Design: Foundation, Auth, Database, Dashboard Shell

**Status:** Approved for implementation
**Date:** 2026-08-27

## Purpose

FlowDo is a full-stack productivity app (tasks, projects, calendar, analytics).
The full product is too large for one spec/plan cycle, so it is decomposed by
the phases already defined in the project's CLAUDE.md:

- **Phase 1 (this spec):** project setup, full database schema + RLS, auth
  (signup/login/OTP verification/password reset/logout), protected routes,
  dashboard shell with empty states.
- Phase 2: tasks, projects, priorities, due dates, completion, search, filtering.
- Phase 3: subtasks, labels, calendar, recurring tasks, activity, notifications.
- Phase 4: analytics, realtime collaboration, project members, advanced features.
- Phase 5: AI features.

Each later phase gets its own brainstorm → spec → plan cycle once Phase 1 is
solid end-to-end.

## Goals for Phase 1

A user can sign up, verify their email via a 6-digit OTP, log in, get
redirected into a working (if empty) dashboard shell, navigate all top-level
views, edit their profile/password, and log out — all backed by a real
Postgres schema with RLS enforced and verified by tests. No task or project
data operations exist yet; those are Phase 2.

## Non-goals

Task/project CRUD, subtasks, labels, calendar rendering, recurring task logic,
notification delivery, analytics charts, realtime subscriptions, Google OAuth,
Resend SMTP wiring (deferred — Supabase's default auth email is used for now).

## Tech stack

- Next.js (App Router) + TypeScript (strict) + React
- Tailwind CSS + shadcn/ui + Lucide icons
- React Hook Form + Zod for all forms
- TanStack Query (wired up; lightly used until Phase 2)
- Supabase: Postgres, Auth, RLS — via `@supabase/ssr` (not the deprecated
  auth-helpers package)
- Package manager: npm
- Testing: Vitest + React Testing Library (unit/component); integration tests
  for auth/RLS run against a **local Supabase instance** started via the
  Supabase CLI (`supabase start`, Docker-backed) — isolated from the real
  project, safe to re-run and use in CI
- Supabase CLI (via `npx supabase`) for migrations, linked to the real
  project for `db push` in addition to local dev

## Architecture

### Session handling

`@supabase/ssr` provides browser and server clients that read/write the
Supabase session via cookies. A single `middleware.ts`:

1. Refreshes the session on every request.
2. Redirects unauthenticated users hitting `/app/*` to `/login`.
3. Redirects authenticated-but-unverified users (no `email_confirmed_at`) to
   `/verify`.
4. Redirects authenticated+verified users hitting `/login`, `/signup`, or
   `/verify` to `/app/dashboard`.

Server Components read the session via the server client for SSR-safe
protected pages; Client Components use the browser client for interactive
forms.

### Database schema

All application tables live in a dedicated **`flowdo` Postgres schema**, not
`public` — keeps application objects clearly separated from Supabase's own
`public`/`graphql_public`/`storage` schemas and from any future extensions.
`auth.users` stays where Supabase Auth owns it; `flowdo.profiles` references
it by FK.

Tables from CLAUDE.md section 5, created now even though most aren't used by
UI until later phases (avoids migration churn, lets RLS get tested upfront):

```
flowdo.profiles         (id -> auth.users.id, email, full_name, avatar_url, timestamps)
flowdo.projects         (id, name, description, color, icon, owner_id, timestamps)
flowdo.project_members  (id, project_id, user_id, role[OWNER|ADMIN|MEMBER|VIEWER], created_at)
flowdo.tasks            (id, user_id, project_id, parent_task_id, title, description,
                          status[TODO|IN_PROGRESS|COMPLETED|CANCELLED],
                          priority[LOW|MEDIUM|HIGH|URGENT], due_date, completed_at,
                          position, timestamps)
flowdo.labels           (id, user_id, name, color, created_at)
flowdo.task_labels      (task_id, label_id)
flowdo.notifications    (id, user_id, task_id, type, title, message, is_read, created_at)
flowdo.activity_logs    (id, user_id, task_id, project_id, action, metadata, created_at)
```

Details:

- `status`, `priority`, `role` are Postgres enums created in the `flowdo`
  schema (`flowdo.task_status`, `flowdo.task_priority`, `flowdo.member_role`),
  not free-text.
- Every table has FKs with sensible cascade: deleting a project cascades to
  its tasks and `project_members`; deleting a task cascades to child tasks
  (`parent_task_id`) and `task_labels`; deleting a label cascades to
  `task_labels`.
- Indexes on all FK columns plus `tasks.due_date`, `tasks.status`,
  `tasks.user_id`.
- `updated_at` maintained via a trigger (`flowdo.set_updated_at()`), not
  application code.
- `flowdo.profiles` row is created automatically via a trigger
  (`flowdo.handle_new_user`) on `auth.users` insert, populating `full_name`
  from signup metadata. The trigger function is `SECURITY DEFINER` (it must
  write into `flowdo` from an `auth`-schema trigger context).

**Exposing the schema:** Supabase's PostgREST API only serves schemas
explicitly exposed to it.
- Local dev: `supabase/config.toml` sets `[api] schemas = ["public", "flowdo", "graphql_public"]`.
- Hosted project: `flowdo` must be added under Project Settings → API →
  Data API Settings → Exposed schemas in the Supabase dashboard. This is a
  one-time manual dashboard step (not achievable via SQL migration or the
  CLI) — called out explicitly in the setup task and the README.
- Every migration that creates `flowdo` also grants schema usage and table
  privileges to `anon`, `authenticated`, and sets matching default
  privileges for future tables, since RLS — not schema grants — is what
  actually restricts row access.
- All Supabase clients (`lib/supabase/client.ts`, `server.ts`, and any
  service-role client) are constructed with `{ db: { schema: 'flowdo' } }`
  so `.from('tasks')` etc. resolve against `flowdo.tasks`. This setting only
  affects PostgREST queries — `supabase.auth.*` calls always target
  Supabase's built-in `auth` schema regardless, so auth code is unaffected.

### Row Level Security

RLS enabled on every table in `flowdo`. Policies derive authorization only
from `auth.uid()`, never from a client-supplied `user_id`:

- `flowdo.profiles`: a user can select/update only their own row.
- `flowdo.tasks`, `flowdo.labels`: owner-only (`user_id = auth.uid()`) for
  all operations.
- `flowdo.projects`: select/update allowed for the owner or any
  `project_members` row matching `auth.uid()` with sufficient role; only
  the owner can delete.
- `flowdo.project_members`: visible to members of the same project; only
  OWNER/ADMIN can insert/delete membership rows.
- `flowdo.task_labels`: allowed only when the requesting user owns both the
  referenced task and label.
- `flowdo.notifications`, `flowdo.activity_logs`: owner-only, insert
  typically via trigger/service role rather than direct client insert.

Migrations live in `supabase/migrations/*.sql`; applied via
`npx supabase link --project-ref <ref>` then `npx supabase db push`. The
first migration creates the `flowdo` schema itself before any table.

### Auth + OTP verification

- **Signup:** collects name/email/password (Zod-validated) →
  `supabase.auth.signUp()` with `full_name` in user metadata → redirect to
  `/verify?email=...`.
- **Email template:** Supabase's "Confirm signup" template is customized to
  show `{{ .Token }}` (6-digit OTP) branded as FlowDo, rather than only a
  magic link.
- **`/verify`:** 6 individual OTP digit inputs (auto-advance, paste support),
  countdown timer, "resend code" (disabled during cooldown; also subject to
  Supabase's own rate limit), "change email" link back to signup, loading/
  error/success states. Submits via
  `supabase.auth.verifyOtp({ email, token, type: 'signup' })`.
- **Login:** `signInWithPassword`; if the returned user has no
  `email_confirmed_at`, redirect to `/verify` instead of the dashboard.
- **Password reset:** `/forgot-password` → `resetPasswordForEmail()` →
  generic "if that email exists, we've sent a link" response (never confirms
  or denies account existence) → `/reset-password` (session established via
  the recovery link) → `updateUser({ password })` → redirect to `/login`.
- **Logout:** `supabase.auth.signOut()`, clears session, redirects to
  `/login`.
- No custom OTP table or custom password storage — entirely Supabase-native.

### Dashboard shell

Responsive app shell under `/app`:

- Sidebar: Dashboard, Inbox, Today, Upcoming, Completed, Calendar, Projects,
  Analytics, Settings. Collapses to a sheet/drawer on mobile.
- Topbar: FlowDo wordmark/icon, user menu (profile, logout).
- Each nav route renders with an honest empty state (no fabricated data) —
  real task/project logic is Phase 2.
- `/app/settings/profile`: edit name/avatar via `flowdo.profiles` table (RLS-owned).
- `/app/settings/security`: change password via `updateUser({ password })`.
- FlowDo brand: simple wordmark + icon mark, usable as favicon/app icon,
  built per `frontend-design:frontend-design` guidance — minimal, calm,
  productivity-focused, no generic-AI-dashboard look, no gratuitous
  gradients/glassmorphism.

### Error/loading/empty states

Every auth form and dashboard route gets explicit loading (skeleton/spinner),
empty (helpful message + action where relevant), and error states (human-
readable, no raw Postgres/Supabase error text surfaced to the user).

## Testing plan

- **Unit/component (Vitest + RTL):** Zod schema validation, OTP input
  component behavior (auto-advance, paste, backspace), redirect-decision
  logic, form error rendering.
- **Integration (against local Supabase via CLI):**
  - Signup creates a user + profile row.
  - Unverified user cannot reach `/app/*` (redirected to `/verify`).
  - OTP verification with wrong code fails; correct code verifies and
    unlocks dashboard access.
  - Login rejects wrong password; rejects unverified account into `/verify`.
  - Logout clears session; protected route then redirects to `/login`.
  - Password reset flow updates the password; old password stops working.
  - **RLS:** user A cannot select/update/delete user B's `flowdo.tasks`,
    `flowdo.labels`, or `flowdo.profiles` row, even when supplying B's ID
    directly — verified by authenticating as two distinct real users
    against local Supabase and asserting Postgres/PostgREST denies
    cross-user access.

## Verification before done

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build` all pass;
migrations apply cleanly to a fresh local Supabase instance; manual smoke
test of signup → OTP verify → dashboard → logout → login → forgot password →
reset → login.

## Environment variables

`.env.example` documents (placeholders only, never real values):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
```

Real credentials for this project go only into a local, gitignored `.env`.
`SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY` are never referenced from
client-side code.
