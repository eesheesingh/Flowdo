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
dashboard shell. See `docs/superpowers/specs/` for the full design and
`docs/superpowers/plans/` for the implementation plan.

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

Phase 2 (tasks, projects, search/filtering), Phase 3 (subtasks, labels,
calendar, recurring tasks, notifications), Phase 4 (analytics, realtime,
project members), Phase 5 (AI features) each get their own spec and plan
once the prior phase is stable.
