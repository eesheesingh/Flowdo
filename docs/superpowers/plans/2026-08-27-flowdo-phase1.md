# FlowDo Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the FlowDo foundation — project scaffold, full `flowdo`-schema Postgres database with RLS, Supabase-native auth (signup, 6-digit OTP verification, login, logout, forgot/reset password), protected routes, and a working (empty-state) dashboard shell.

**Architecture:** Next.js App Router + TypeScript, `@supabase/ssr` for cookie-based sessions, all Supabase auth calls made directly from Client Components via small testable service functions in `lib/auth/*.ts` (no Server Actions needed — these are the intended public Supabase client APIs). All application data lives in a dedicated `flowdo` Postgres schema, RLS-enforced, migrated via the Supabase CLI. Auth/RLS behavior is verified with integration tests against a **local** Supabase instance (Docker via `supabase start`), never the real project.

**Tech Stack:** Next.js (App Router), TypeScript (strict), Tailwind CSS, Radix primitives (hand-authored shadcn-style components), Lucide icons, React Hook Form + Zod, TanStack Query, `@supabase/supabase-js` + `@supabase/ssr`, Vitest + React Testing Library, npm, Supabase CLI (via `npx`).

**Spec:** `docs/superpowers/specs/2026-08-27-flowdo-phase1-design.md`

## Global Constraints

- All application tables live in the `flowdo` Postgres schema, never `public`. (spec: Database schema)
- RLS is enabled on every `flowdo` table; every policy derives authorization from `auth.uid()` only — never a client-supplied `user_id`. (spec: Row Level Security)
- No custom OTP table and no custom password storage — Supabase Auth owns both, entirely via `supabase.auth.*`. (spec: Auth + OTP verification)
- `SUPABASE_SERVICE_ROLE_KEY` is never imported by any file under `app/`, `components/`, or any Client Component — service-role usage is confined to test helpers only in this phase. (spec: Environment variables)
- Package manager is npm. All commands in this plan use `npm`/`npx`.
- Every Supabase client (browser, server, and test service-role clients) is constructed with `{ db: { schema: 'flowdo' } }`.
- RLS/auth integration tests run only against a local Supabase instance started via `npx supabase start`; never against the real project.
- No task/project CRUD logic — dashboard routes render real navigation with honest empty states only. That is Phase 2.

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `postcss.config.mjs`
- Create: `tailwind.config.ts`
- Create: `eslint.config.mjs`
- Create: `app/layout.tsx`
- Create: `app/globals.css`
- Create: `app/page.tsx`
- Create: `app/icon.svg`
- Create: `lib/utils.ts`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `.env.example`

**Interfaces:**
- Produces: `cn(...classes: (string | undefined | false | null)[]): string` from `lib/utils.ts`, used by every component task from here on.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "flowdo",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --config vitest.config.ts",
    "test:watch": "vitest --config vitest.config.ts",
    "test:integration": "vitest run --config vitest.integration.config.ts"
  },
  "dependencies": {
    "@hookform/resolvers": "^3.9.0",
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-dropdown-menu": "^2.1.2",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-slot": "^1.1.0",
    "@supabase/ssr": "^0.5.1",
    "@supabase/supabase-js": "^2.45.4",
    "@tanstack/react-query": "^5.59.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "lucide-react": "^0.451.0",
    "next": "^14.2.15",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.53.0",
    "tailwind-merge": "^2.5.3",
    "tailwindcss-animate": "^1.0.7",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/node": "^22.7.4",
    "@types/pg": "^8.11.10",
    "@types/react": "^18.3.10",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.2",
    "autoprefixer": "^10.4.20",
    "eslint": "^8.57.1",
    "eslint-config-next": "^14.2.15",
    "jsdom": "^25.0.1",
    "pg": "^8.13.0",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.13",
    "typescript": "^5.6.2",
    "vitest": "^2.1.2"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: lockfile `package-lock.json` created, no errors.

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Write `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
```

- [ ] **Step 5: Write `postcss.config.mjs`**

```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 6: Write `tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        border: "hsl(var(--border))",
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
```

- [ ] **Step 7: Write `eslint.config.mjs`**

```js
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { ignores: [".next/**", "node_modules/**"] },
];
```

- [ ] **Step 8: Write `lib/utils.ts`**

```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 9: Write `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 12%;
  --primary: 243 75% 59%;
  --primary-foreground: 0 0% 100%;
  --muted: 240 5% 96%;
  --muted-foreground: 240 4% 46%;
  --border: 240 6% 90%;
  --destructive: 0 72% 51%;
  --destructive-foreground: 0 0% 100%;
  --radius: 0.625rem;
}

.dark {
  --background: 240 10% 8%;
  --foreground: 0 0% 96%;
  --primary: 243 75% 68%;
  --primary-foreground: 240 10% 8%;
  --muted: 240 6% 16%;
  --muted-foreground: 240 5% 65%;
  --border: 240 6% 20%;
  --destructive: 0 63% 55%;
  --destructive-foreground: 0 0% 96%;
}

body {
  background: hsl(var(--background));
  color: hsl(var(--foreground));
}
```

- [ ] **Step 10: Write `app/icon.svg`** (FlowDo brand mark — three ascending bars in a rounded square, evoking momentum/progress)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <rect width="32" height="32" rx="8" fill="#4F46E5"/>
  <rect x="8" y="18" width="4" height="7" rx="1.5" fill="white"/>
  <rect x="14" y="13" width="4" height="12" rx="1.5" fill="white" fill-opacity="0.85"/>
  <rect x="20" y="7" width="4" height="18" rx="1.5" fill="white" fill-opacity="0.7"/>
</svg>
```

- [ ] **Step 11: Write `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlowDo",
  description: "Find Your Flow.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 12: Write `app/page.tsx`** (root just redirects into the app; middleware in Task 5 decides where)

```tsx
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/login");
}
```

- [ ] **Step 13: Write `vitest.config.ts`** (unit/component tests, jsdom)

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", "tests/integration/**"],
  },
});
```

- [ ] **Step 14: Write `vitest.setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 15: Write `.env.example`**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
```

- [ ] **Step 16: Verify the scaffold builds**

Run: `npm run build`
Expected: build succeeds, `/` prerenders (redirect to `/login`, which 404s until Task 9 — that's fine, the build itself must still succeed since redirect targets aren't validated at build time).

- [ ] **Step 17: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.mjs postcss.config.mjs tailwind.config.ts eslint.config.mjs app lib vitest.config.ts vitest.setup.ts .env.example .gitignore
git commit -m "feat: scaffold Next.js project with Tailwind, Vitest, and FlowDo brand icon"
```

---

### Task 2: Supabase local + CLI setup

**Files:**
- Create: `supabase/config.toml` (via CLI, then edited)
- Create: `supabase/migrations/0001_create_flowdo_schema.sql`
- Create: `.env.test`
- Modify: `.gitignore`
- Create: `tests/helpers/admin-client.ts`
- Create: `vitest.integration.config.ts`

**Interfaces:**
- Produces: the empty `flowdo` schema (with `usage`/default-privilege grants) from `supabase/migrations/0001_create_flowdo_schema.sql` — a bootstrap migration Task 3 builds on top of; without it, `supabase start`'s PostgREST health check fails against a schema that doesn't exist yet.
- Produces: `createAdminClient(): SupabaseClient` from `tests/helpers/admin-client.ts` — a service-role client pointed at the **local** Supabase instance, schema `flowdo`, used by every integration test task from here on to set up/tear down test users.
- Produces: `LOCAL_SUPABASE_URL: string`, `LOCAL_SUPABASE_ANON_KEY: string` exported constants from the same file, read from `.env.test`.

- [ ] **Step 1: Initialize the Supabase CLI project**

Run: `npx supabase init`
Expected: creates `supabase/config.toml` and `supabase/.gitignore`. If prompted to install the CLI, accept.

- [ ] **Step 2: Expose the `flowdo` schema for local dev**

Open `supabase/config.toml`, find the `[api]` section's `schemas` line, and change it to include `flowdo`:

```toml
[api]
enabled = true
port = 54321
schemas = ["public", "flowdo", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000
```

- [ ] **Step 3: Write a bootstrap migration for the `flowdo` schema**

`supabase start`'s PostgREST health check fails if a schema listed in `[api] schemas` doesn't exist yet in the database — and on a fresh local volume, `flowdo` won't exist until a migration creates it. Create `supabase/migrations/0001_create_flowdo_schema.sql` now so the very first `supabase start` succeeds; Task 3 will add the actual tables in a later migration on top of this:

```sql
create schema if not exists flowdo;

grant usage on schema flowdo to anon, authenticated, service_role;
alter default privileges in schema flowdo
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema flowdo
  grant usage, select on sequences to anon, authenticated;
```

- [ ] **Step 4: Start local Supabase**

Run: `npx supabase start`
Expected: Docker containers start; output prints `API URL`, `anon key`, `service_role key`. This will take a few minutes on first run (image pulls). The bootstrap migration from Step 3 runs automatically during startup, so PostgREST's health check against the `flowdo` schema passes.

- [ ] **Step 5: Record local dev credentials**

Run: `npx supabase status`
Copy the printed `API URL`, `anon key`, and `service_role key` into a new `.env.test` file:

```
NEXT_PUBLIC_SUPABASE_URL=<API URL from supabase status>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase status>
```

These are local-only Docker credentials (not the real project's), safe to commit — but double check `npx supabase status` output doesn't differ per machine before committing; if it's identical across runs on this CLI version, commit it, otherwise add `.env.test` to `.gitignore` instead and note in the README that contributors must generate their own via `supabase status`.

- [ ] **Step 6: Write `tests/helpers/admin-client.ts`**

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.test" });

export const LOCAL_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const LOCAL_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const LOCAL_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export function createAdminClient(): SupabaseClient {
  return createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_ROLE_KEY, {
    db: { schema: "flowdo" },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function createAnonClient(): SupabaseClient {
  return createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY, {
    db: { schema: "flowdo" },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

- [ ] **Step 7: Install `dotenv`**

Run: `npm install --save-dev dotenv`

- [ ] **Step 8: Write `vitest.integration.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
```

- [ ] **Step 9: Write a smoke integration test to prove the harness works**

Create `tests/integration/harness.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createAdminClient } from "../helpers/admin-client";

describe("integration test harness", () => {
  it("can reach the local Supabase auth admin API", async () => {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.listUsers();
    expect(error).toBeNull();
    expect(Array.isArray(data.users)).toBe(true);
  });
});
```

- [ ] **Step 10: Run it**

Run: `npm run test:integration`
Expected: PASS (requires `npx supabase start` to already be running).

- [ ] **Step 11: Update `.gitignore`**

Add lines: `supabase/.temp` and confirm `.env`/`.env.local` remain ignored (added in an earlier step). `.env.test` and `.env.example` are NOT ignored — they contain no real secrets.

- [ ] **Step 12: Commit**

```bash
git add supabase/config.toml supabase/.gitignore supabase/migrations/0001_create_flowdo_schema.sql .env.test .gitignore tests/helpers/admin-client.ts vitest.integration.config.ts package.json package-lock.json
git commit -m "feat: add local Supabase CLI setup and integration test harness"
```

---

### Task 3: Database schema migration

**Files:**
- Create: `supabase/migrations/0002_schema_tables.sql`
- Create: `tests/integration/schema.test.ts`
- Create: `tests/helpers/pg-client.ts`

**Interfaces:**
- Consumes: the `flowdo` schema created by Task 2's `supabase/migrations/0001_create_flowdo_schema.sql` bootstrap migration — this task's migration only adds enums/tables/triggers on top of it, it does not re-create the schema.
- Produces: tables `profiles`, `projects`, `project_members`, `tasks`, `labels`, `task_labels`, `notifications`, `activity_logs` in the `flowdo` schema, consumed by every later task's RLS policies and application code.
- Produces: `queryLocalDb(sql: string, params?: unknown[]): Promise<QueryResult>` from `tests/helpers/pg-client.ts`, used to verify schema/constraints directly.

- [ ] **Step 1: Write `tests/helpers/pg-client.ts`**

```ts
import { Client } from "pg";

export async function queryLocalDb(sql: string, params: unknown[] = []) {
  const client = new Client({
    connectionString: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  });
  await client.connect();
  try {
    return await client.query(sql, params);
  } finally {
    await client.end();
  }
}
```

- [ ] **Step 2: Write the failing schema test**

Create `tests/integration/schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { queryLocalDb } from "../helpers/pg-client";

describe("flowdo schema", () => {
  it("creates the flowdo schema with all expected tables", async () => {
    const result = await queryLocalDb(
      `select table_name from information_schema.tables where table_schema = 'flowdo' order by table_name`
    );
    const tableNames = result.rows.map((r) => r.table_name);
    expect(tableNames).toEqual([
      "activity_logs",
      "labels",
      "notifications",
      "profiles",
      "project_members",
      "projects",
      "task_labels",
      "tasks",
    ]);
  });

  it("cascades task deletion to task_labels", async () => {
    await queryLocalDb(`delete from flowdo.profiles`); // clean slate for this test's inserts
    const user = await queryLocalDb(
      `insert into auth.users (id, email) values (gen_random_uuid(), 'schema-test@example.com') returning id`
    );
    const userId = user.rows[0].id;
    const task = await queryLocalDb(
      `insert into flowdo.tasks (user_id, title) values ($1, 'test task') returning id`,
      [userId]
    );
    const label = await queryLocalDb(
      `insert into flowdo.labels (user_id, name) values ($1, 'test label') returning id`,
      [userId]
    );
    await queryLocalDb(`insert into flowdo.task_labels (task_id, label_id) values ($1, $2)`, [
      task.rows[0].id,
      label.rows[0].id,
    ]);
    await queryLocalDb(`delete from flowdo.tasks where id = $1`, [task.rows[0].id]);
    const remaining = await queryLocalDb(`select * from flowdo.task_labels where task_id = $1`, [
      task.rows[0].id,
    ]);
    expect(remaining.rows.length).toBe(0);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm run test:integration`
Expected: FAIL — `relation "flowdo.tasks" does not exist` (or similar) since the migration doesn't exist yet.

- [ ] **Step 4: Write `supabase/migrations/0002_schema_tables.sql`**

The `flowdo` schema itself (plus its usage/default-privilege grants) already exists from Task 2's `0001_create_flowdo_schema.sql` bootstrap migration — this migration only adds enums, tables, and triggers on top of it:

```sql
create type flowdo.task_status as enum ('TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
create type flowdo.task_priority as enum ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
create type flowdo.member_role as enum ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

create or replace function flowdo.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table flowdo.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on flowdo.profiles
  for each row execute function flowdo.set_updated_at();

create or replace function flowdo.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = flowdo, public
as $$
begin
  insert into flowdo.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function flowdo.handle_new_user();

create table flowdo.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  color text not null default '#4F46E5',
  icon text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_owner_id_idx on flowdo.projects (owner_id);
create trigger set_updated_at before update on flowdo.projects
  for each row execute function flowdo.set_updated_at();

create table flowdo.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references flowdo.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role flowdo.member_role not null default 'MEMBER',
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create index project_members_project_id_idx on flowdo.project_members (project_id);
create index project_members_user_id_idx on flowdo.project_members (user_id);

create table flowdo.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references flowdo.projects(id) on delete cascade,
  parent_task_id uuid references flowdo.tasks(id) on delete cascade,
  title text not null,
  description text,
  status flowdo.task_status not null default 'TODO',
  priority flowdo.task_priority not null default 'MEDIUM',
  due_date timestamptz,
  completed_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_user_id_idx on flowdo.tasks (user_id);
create index tasks_project_id_idx on flowdo.tasks (project_id);
create index tasks_parent_task_id_idx on flowdo.tasks (parent_task_id);
create index tasks_due_date_idx on flowdo.tasks (due_date);
create index tasks_status_idx on flowdo.tasks (status);
create trigger set_updated_at before update on flowdo.tasks
  for each row execute function flowdo.set_updated_at();

create table flowdo.labels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#4F46E5',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index labels_user_id_idx on flowdo.labels (user_id);

create table flowdo.task_labels (
  task_id uuid not null references flowdo.tasks(id) on delete cascade,
  label_id uuid not null references flowdo.labels(id) on delete cascade,
  primary key (task_id, label_id)
);

create index task_labels_label_id_idx on flowdo.task_labels (label_id);

create table flowdo.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references flowdo.tasks(id) on delete cascade,
  type text not null,
  title text not null,
  message text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_id_idx on flowdo.notifications (user_id);

create table flowdo.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references flowdo.tasks(id) on delete set null,
  project_id uuid references flowdo.projects(id) on delete set null,
  action text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index activity_logs_user_id_idx on flowdo.activity_logs (user_id);
```

- [ ] **Step 5: Apply the migration locally**

Run: `npx supabase db reset`
Expected: local DB is recreated from scratch and this migration applies cleanly with no errors.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm run test:integration`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0002_schema_tables.sql tests/integration/schema.test.ts tests/helpers/pg-client.ts
git commit -m "feat: add flowdo schema, enums, tables, and cascade/index constraints"
```

---

### Task 4: RLS policies migration

**Files:**
- Create: `supabase/migrations/0003_rls_policies.sql`
- Create: `tests/integration/rls.test.ts`
- Create: `tests/helpers/test-user.ts`

**Interfaces:**
- Produces: `createConfirmedTestUser(admin: SupabaseClient, email: string, password: string): Promise<{ userId: string; client: SupabaseClient }>` from `tests/helpers/test-user.ts` — creates a pre-confirmed user via the admin API and returns a signed-in anon-key client for that user, used by every later auth integration test.

- [ ] **Step 1: Write `tests/helpers/test-user.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAnonClient } from "./admin-client";

export async function createConfirmedTestUser(
  admin: SupabaseClient,
  email: string,
  password: string
) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`failed to create test user: ${error?.message}`);
  }

  const client = createAnonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) {
    throw new Error(`failed to sign in test user: ${signInError.message}`);
  }

  return { userId: data.user.id, client };
}
```

- [ ] **Step 2: Write the failing RLS test**

Create `tests/integration/rls.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient } from "../helpers/admin-client";
import { createConfirmedTestUser } from "../helpers/test-user";

const admin = createAdminClient();
const createdUserIds: string[] = [];

afterEach(async () => {
  for (const id of createdUserIds.splice(0)) {
    await admin.auth.admin.deleteUser(id);
  }
});

describe("RLS: tasks", () => {
  it("prevents a user from reading another user's tasks", async () => {
    const a = await createConfirmedTestUser(admin, "rls-a@example.com", "Password123!");
    const b = await createConfirmedTestUser(admin, "rls-b@example.com", "Password123!");
    createdUserIds.push(a.userId, b.userId);

    const { error: insertError } = await a.client
      .from("tasks")
      .insert({ user_id: a.userId, title: "A's private task" });
    expect(insertError).toBeNull();

    const { data, error } = await b.client.from("tasks").select("*").eq("user_id", a.userId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("prevents a user from updating another user's task by supplying its id directly", async () => {
    const a = await createConfirmedTestUser(admin, "rls-c@example.com", "Password123!");
    const b = await createConfirmedTestUser(admin, "rls-d@example.com", "Password123!");
    createdUserIds.push(a.userId, b.userId);

    const { data: inserted } = await a.client
      .from("tasks")
      .insert({ user_id: a.userId, title: "A's task" })
      .select()
      .single();

    const { data: updated, error } = await b.client
      .from("tasks")
      .update({ title: "hijacked" })
      .eq("id", inserted!.id)
      .select();
    expect(error).toBeNull();
    expect(updated).toEqual([]);

    const { data: stillOriginal } = await a.client
      .from("tasks")
      .select("title")
      .eq("id", inserted!.id)
      .single();
    expect(stillOriginal?.title).toBe("A's task");
  });
});

describe("RLS: labels", () => {
  it("prevents a user from deleting another user's label", async () => {
    const a = await createConfirmedTestUser(admin, "rls-e@example.com", "Password123!");
    const b = await createConfirmedTestUser(admin, "rls-f@example.com", "Password123!");
    createdUserIds.push(a.userId, b.userId);

    const { data: label } = await a.client
      .from("labels")
      .insert({ user_id: a.userId, name: "urgent" })
      .select()
      .single();

    await b.client.from("labels").delete().eq("id", label!.id);

    const { data: stillThere } = await a.client.from("labels").select("*").eq("id", label!.id);
    expect(stillThere?.length).toBe(1);
  });
});

describe("RLS: profiles", () => {
  it("prevents a user from reading another user's profile row", async () => {
    const a = await createConfirmedTestUser(admin, "rls-g@example.com", "Password123!");
    const b = await createConfirmedTestUser(admin, "rls-h@example.com", "Password123!");
    createdUserIds.push(a.userId, b.userId);

    const { data, error } = await b.client.from("profiles").select("*").eq("id", a.userId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

describe("RLS: project_members recursion guard", () => {
  it("lets an owner and a member list projects and project_members without recursion errors", async () => {
    const owner = await createConfirmedTestUser(admin, "rls-proj-owner@example.com", "Password123!");
    const member = await createConfirmedTestUser(admin, "rls-proj-member@example.com", "Password123!");
    createdUserIds.push(owner.userId, member.userId);

    const { data: project, error: projectError } = await owner.client
      .from("projects")
      .insert({ name: "Recursion test project", owner_id: owner.userId })
      .select()
      .single();
    expect(projectError).toBeNull();

    const { error: memberInsertError } = await owner.client
      .from("project_members")
      .insert({ project_id: project!.id, user_id: member.userId, role: "MEMBER" });
    expect(memberInsertError).toBeNull();

    const { data: memberProjects, error: memberSelectError } = await member.client
      .from("projects")
      .select("*")
      .eq("id", project!.id);
    expect(memberSelectError).toBeNull();
    expect(memberProjects?.length).toBe(1);

    const { data: memberRows, error: memberRowsError } = await member.client
      .from("project_members")
      .select("*")
      .eq("project_id", project!.id);
    expect(memberRowsError).toBeNull();
    expect(memberRows?.length).toBe(2);
  });
});

describe("RLS: projects owner_id transfer guard", () => {
  it("prevents a non-owner admin from reassigning owner_id, but allows other field updates", async () => {
    const owner = await createConfirmedTestUser(admin, "rls-owner-guard@example.com", "Password123!");
    const adminMember = await createConfirmedTestUser(admin, "rls-admin-guard@example.com", "Password123!");
    createdUserIds.push(owner.userId, adminMember.userId);

    const { data: project } = await owner.client
      .from("projects")
      .insert({ name: "Ownership guard project", owner_id: owner.userId })
      .select()
      .single();

    await owner.client
      .from("project_members")
      .insert({ project_id: project!.id, user_id: adminMember.userId, role: "ADMIN" });

    const { error: hijackError } = await adminMember.client
      .from("projects")
      .update({ owner_id: adminMember.userId })
      .eq("id", project!.id);
    expect(hijackError).toBeTruthy();

    const { data: stillOwnedByOriginal } = await owner.client
      .from("projects")
      .select("owner_id")
      .eq("id", project!.id)
      .single();
    expect(stillOwnedByOriginal?.owner_id).toBe(owner.userId);

    const { error: renameError } = await adminMember.client
      .from("projects")
      .update({ name: "Renamed by admin" })
      .eq("id", project!.id);
    expect(renameError).toBeNull();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm run test:integration`
Expected: FAIL — without RLS, user B can read/update/delete user A's rows, so the "prevents" assertions fail (e.g. `data` is not `[]`).

- [ ] **Step 4: Write `supabase/migrations/0003_rls_policies.sql`**

```sql
alter table flowdo.profiles enable row level security;
alter table flowdo.projects enable row level security;
alter table flowdo.project_members enable row level security;
alter table flowdo.tasks enable row level security;
alter table flowdo.labels enable row level security;
alter table flowdo.task_labels enable row level security;
alter table flowdo.notifications enable row level security;
alter table flowdo.activity_logs enable row level security;

create policy "profiles_select_own" on flowdo.profiles
  for select using (id = auth.uid());
create policy "profiles_update_own" on flowdo.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "tasks_select_own" on flowdo.tasks
  for select using (user_id = auth.uid());
create policy "tasks_insert_own" on flowdo.tasks
  for insert with check (user_id = auth.uid());
create policy "tasks_update_own" on flowdo.tasks
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "tasks_delete_own" on flowdo.tasks
  for delete using (user_id = auth.uid());

create policy "labels_select_own" on flowdo.labels
  for select using (user_id = auth.uid());
create policy "labels_insert_own" on flowdo.labels
  for insert with check (user_id = auth.uid());
create policy "labels_update_own" on flowdo.labels
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "labels_delete_own" on flowdo.labels
  for delete using (user_id = auth.uid());

-- Helper functions to avoid recursive RLS policy evaluation: a policy ON
-- project_members that queries project_members directly causes Postgres
-- error 42P17 "infinite recursion detected in policy". SECURITY DEFINER
-- functions run as their owner (the migration role, which owns the table
-- and therefore bypasses its own RLS), so calling one from a policy breaks
-- the cycle instead of re-triggering it.
create or replace function flowdo.is_project_member(_project_id uuid, _user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = flowdo, public
as $$
  select exists (
    select 1 from flowdo.project_members
    where project_id = _project_id and user_id = _user_id
  );
$$;

create or replace function flowdo.is_project_admin(_project_id uuid, _user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = flowdo, public
as $$
  select exists (
    select 1 from flowdo.project_members
    where project_id = _project_id and user_id = _user_id and role in ('OWNER', 'ADMIN')
  );
$$;

-- RLS's WITH CHECK only sees the proposed new row, not the old one, so it
-- cannot by itself stop an ADMIN (non-owner) from reassigning owner_id while
-- otherwise legitimately updating a project. A trigger has both OLD and NEW.
create or replace function flowdo.prevent_unauthorized_owner_change()
returns trigger
language plpgsql
security definer
set search_path = flowdo, public
as $$
begin
  if new.owner_id is distinct from old.owner_id and old.owner_id <> auth.uid() then
    raise exception 'Only the current project owner can transfer ownership';
  end if;
  return new;
end;
$$;

create trigger prevent_unauthorized_owner_change
  before update on flowdo.projects
  for each row execute function flowdo.prevent_unauthorized_owner_change();

create policy "projects_select_member" on flowdo.projects
  for select using (
    owner_id = auth.uid()
    or flowdo.is_project_member(id, auth.uid())
  );
create policy "projects_insert_own" on flowdo.projects
  for insert with check (owner_id = auth.uid());
create policy "projects_update_admin" on flowdo.projects
  for update using (
    owner_id = auth.uid()
    or flowdo.is_project_admin(id, auth.uid())
  ) with check (
    owner_id = auth.uid()
    or flowdo.is_project_admin(id, auth.uid())
  );
create policy "projects_delete_owner" on flowdo.projects
  for delete using (owner_id = auth.uid());

create policy "project_members_select_same_project" on flowdo.project_members
  for select using (
    flowdo.is_project_member(project_id, auth.uid())
    or exists (
      select 1 from flowdo.projects p
      where p.id = project_members.project_id and p.owner_id = auth.uid()
    )
  );
create policy "project_members_insert_admin" on flowdo.project_members
  for insert with check (
    exists (
      select 1 from flowdo.projects p
      where p.id = project_members.project_id and p.owner_id = auth.uid()
    )
    or flowdo.is_project_admin(project_id, auth.uid())
  );
create policy "project_members_delete_admin" on flowdo.project_members
  for delete using (
    exists (
      select 1 from flowdo.projects p
      where p.id = project_members.project_id and p.owner_id = auth.uid()
    )
    or flowdo.is_project_admin(project_id, auth.uid())
  );

create policy "task_labels_select_own" on flowdo.task_labels
  for select using (
    exists (select 1 from flowdo.tasks t where t.id = task_labels.task_id and t.user_id = auth.uid())
  );
create policy "task_labels_insert_own" on flowdo.task_labels
  for insert with check (
    exists (select 1 from flowdo.tasks t where t.id = task_labels.task_id and t.user_id = auth.uid())
    and exists (select 1 from flowdo.labels l where l.id = task_labels.label_id and l.user_id = auth.uid())
  );
create policy "task_labels_delete_own" on flowdo.task_labels
  for delete using (
    exists (select 1 from flowdo.tasks t where t.id = task_labels.task_id and t.user_id = auth.uid())
  );

create policy "notifications_select_own" on flowdo.notifications
  for select using (user_id = auth.uid());
create policy "notifications_update_own" on flowdo.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications_delete_own" on flowdo.notifications
  for delete using (user_id = auth.uid());

create policy "activity_logs_select_own" on flowdo.activity_logs
  for select using (user_id = auth.uid());
```

- [ ] **Step 5: Apply and run tests**

Run: `npx supabase db reset && npm run test:integration`
Expected: PASS — all RLS tests, plus the Task 3 schema tests, pass.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0003_rls_policies.sql tests/integration/rls.test.ts tests/helpers/test-user.ts
git commit -m "fix: enforce ownership and membership via RLS across all flowdo tables"
```

---

### Task 5: Supabase client libraries + protected-route middleware

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/middleware.ts`
- Create: `lib/auth/redirect.ts`
- Create: `lib/auth/redirect.test.ts`
- Create: `middleware.ts`
- Create: `types/database.ts`

**Interfaces:**
- Produces: `createClient(): SupabaseClient<Database>` from `lib/supabase/client.ts` (browser), used by every auth page task.
- Produces: `createServerClient(): Promise<SupabaseClient<Database>>` from `lib/supabase/server.ts` (Server Components), used by protected dashboard pages.
- Produces: `resolveRedirect(input: { pathname: string; isAuthenticated: boolean; isVerified: boolean }): string | null` from `lib/auth/redirect.ts` — pure function, `null` means no redirect.

- [ ] **Step 1: Write `types/database.ts`** (minimal typed shape used by clients in this phase; expanded in Phase 2)

```ts
export type Database = {
  flowdo: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["flowdo"]["Tables"]["profiles"]["Row"]> & { id: string; email: string };
        Update: Partial<Database["flowdo"]["Tables"]["profiles"]["Row"]>;
      };
    };
  };
};
```

- [ ] **Step 2: Write `lib/supabase/client.ts`**

```ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: "flowdo" } }
  );
}
```

- [ ] **Step 3: Write `lib/supabase/server.ts`**

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "flowdo" },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a Server Component render; middleware refreshes the session instead
          }
        },
      },
    }
  );
}
```

- [ ] **Step 4: Write the failing redirect-logic test**

Create `lib/auth/redirect.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveRedirect } from "./redirect";

describe("resolveRedirect", () => {
  it("sends an unauthenticated user hitting /app to /login", () => {
    expect(
      resolveRedirect({ pathname: "/app/dashboard", isAuthenticated: false, isVerified: false })
    ).toBe("/login");
  });

  it("sends an authenticated but unverified user hitting /app to /verify", () => {
    expect(
      resolveRedirect({ pathname: "/app/dashboard", isAuthenticated: true, isVerified: false })
    ).toBe("/verify");
  });

  it("allows an authenticated and verified user into /app", () => {
    expect(
      resolveRedirect({ pathname: "/app/dashboard", isAuthenticated: true, isVerified: true })
    ).toBeNull();
  });

  it("sends an authenticated and verified user away from /login to the dashboard", () => {
    expect(
      resolveRedirect({ pathname: "/login", isAuthenticated: true, isVerified: true })
    ).toBe("/app/dashboard");
  });

  it("does not redirect an unauthenticated user visiting /login", () => {
    expect(
      resolveRedirect({ pathname: "/login", isAuthenticated: false, isVerified: false })
    ).toBeNull();
  });

  it("does not redirect an authenticated unverified user visiting /verify", () => {
    expect(
      resolveRedirect({ pathname: "/verify", isAuthenticated: true, isVerified: false })
    ).toBeNull();
  });

  it("sends an authenticated and verified user away from /verify to the dashboard", () => {
    expect(
      resolveRedirect({ pathname: "/verify", isAuthenticated: true, isVerified: true })
    ).toBe("/app/dashboard");
  });
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — `lib/auth/redirect.ts` doesn't exist yet.

- [ ] **Step 6: Write `lib/auth/redirect.ts`**

```ts
const GUEST_ONLY_PATHS = ["/login", "/signup", "/verify", "/forgot-password", "/reset-password"];

export function resolveRedirect(input: {
  pathname: string;
  isAuthenticated: boolean;
  isVerified: boolean;
}): string | null {
  const { pathname, isAuthenticated, isVerified } = input;
  const isAppRoute = pathname.startsWith("/app");
  const isGuestOnlyRoute = GUEST_ONLY_PATHS.some((p) => pathname.startsWith(p));

  if (isAppRoute) {
    if (!isAuthenticated) return "/login";
    if (!isVerified && pathname !== "/verify") return "/verify";
    return null;
  }

  if (isGuestOnlyRoute) {
    if (isAuthenticated && isVerified) return "/app/dashboard";
  }

  return null;
}
```

- [ ] **Step 7: Run it to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Write `lib/supabase/middleware.ts`**

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolveRedirect } from "@/lib/auth/redirect";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "flowdo" },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const redirectTo = resolveRedirect({
    pathname: request.nextUrl.pathname,
    isAuthenticated: Boolean(user),
    isVerified: Boolean(user?.email_confirmed_at),
  });

  if (redirectTo) {
    const url = request.nextUrl.clone();
    url.pathname = redirectTo;
    return NextResponse.redirect(url);
  }

  return response;
}
```

- [ ] **Step 9: Write root `middleware.ts`**

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
```

- [ ] **Step 10: Verify typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed.

- [ ] **Step 11: Commit**

```bash
git add lib/supabase lib/auth/redirect.ts lib/auth/redirect.test.ts middleware.ts types/database.ts
git commit -m "feat: add Supabase SSR clients and protected-route middleware"
```

---

### Task 6: Shared UI primitives + validation schemas

**Files:**
- Create: `components/ui/button.tsx`
- Create: `components/ui/input.tsx`
- Create: `components/ui/label.tsx`
- Create: `components/ui/form-error.tsx`
- Create: `components/auth/otp-input.tsx`
- Create: `components/auth/otp-input.test.tsx`
- Create: `lib/validations/auth.ts`
- Create: `lib/validations/auth.test.ts`

**Interfaces:**
- Produces: `<Button>`, `<Input>`, `<Label>`, `<FormError message?: string>` — used by every auth page.
- Produces: `<OtpInput value: string, onChange: (value: string) => void, length?: number, disabled?: boolean>` — used by the `/verify` page (Task 8).
- Produces: `signupSchema`, `loginSchema`, `otpSchema`, `forgotPasswordSchema`, `resetPasswordSchema` (Zod schemas + inferred types) from `lib/validations/auth.ts` — used by every auth page's `react-hook-form` resolver.

- [ ] **Step 1: Write `components/ui/button.tsx`**

```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:opacity-90",
        outline: "border border-border bg-transparent hover:bg-muted",
        ghost: "hover:bg-muted",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";
```

- [ ] **Step 2: Write `components/ui/input.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";
```

- [ ] **Step 3: Write `components/ui/label.tsx`**

```tsx
"use client";
import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn("text-sm font-medium", className)} {...props} />
));
Label.displayName = "Label";
```

- [ ] **Step 4: Write `components/ui/form-error.tsx`**

```tsx
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}
```

- [ ] **Step 5: Write the failing validation schema tests**

Create `lib/validations/auth.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { signupSchema, loginSchema, otpSchema, resetPasswordSchema } from "./auth";

describe("signupSchema", () => {
  it("accepts a valid signup", () => {
    const result = signupSchema.safeParse({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      password: "StrongPass123!",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a short password", () => {
    const result = signupSchema.safeParse({
      fullName: "Ada",
      email: "ada@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = signupSchema.safeParse({
      fullName: "Ada",
      email: "not-an-email",
      password: "StrongPass123!",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("requires both email and password", () => {
    expect(loginSchema.safeParse({ email: "a@example.com", password: "" }).success).toBe(false);
  });
});

describe("otpSchema", () => {
  it("requires exactly 6 digits", () => {
    expect(otpSchema.safeParse({ code: "123456" }).success).toBe(true);
    expect(otpSchema.safeParse({ code: "12345" }).success).toBe(false);
    expect(otpSchema.safeParse({ code: "12345a" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("requires password and confirmPassword to match", () => {
    const result = resetPasswordSchema.safeParse({
      password: "StrongPass123!",
      confirmPassword: "Different123!",
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — `lib/validations/auth.ts` doesn't exist.

- [ ] **Step 7: Write `lib/validations/auth.ts`**

```ts
import { z } from "zod";

export const signupSchema = z.object({
  fullName: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const otpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});
export type OtpInput = z.infer<typeof otpSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 9: Write the failing OTP input component test**

Create `components/auth/otp-input.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OtpInput } from "./otp-input";

describe("OtpInput", () => {
  it("renders 6 digit boxes by default", () => {
    render(<OtpInput value="" onChange={() => {}} />);
    expect(screen.getAllByRole("textbox")).toHaveLength(6);
  });

  it("auto-advances focus and reports the combined value on typing", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    function Wrapper() {
      const [value, setValue] = require("react").useState("");
      return (
        <OtpInput
          value={value}
          onChange={(v: string) => {
            setValue(v);
            handleChange(v);
          }}
        />
      );
    }
    render(<Wrapper />);
    const boxes = screen.getAllByRole("textbox");
    await user.type(boxes[0], "1");
    await user.type(boxes[1], "2");
    expect(handleChange).toHaveBeenLastCalledWith("12");
  });

  it("fills all boxes from a pasted 6-digit code", async () => {
    const handleChange = vi.fn();
    render(<OtpInput value="" onChange={handleChange} />);
    const boxes = screen.getAllByRole("textbox");
    const clipboardData = { getData: () => "482913" };
    boxes[0].focus();
    const pasteEvent = new Event("paste", { bubbles: true, cancelable: true }) as unknown as ClipboardEvent;
    Object.defineProperty(pasteEvent, "clipboardData", { value: clipboardData });
    boxes[0].dispatchEvent(pasteEvent);
    expect(handleChange).toHaveBeenCalledWith("482913");
  });
});
```

- [ ] **Step 10: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — `components/auth/otp-input.tsx` doesn't exist.

- [ ] **Step 11: Write `components/auth/otp-input.tsx`**

```tsx
"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
}

export function OtpInput({ value, onChange, length = 6, disabled }: OtpInputProps) {
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  const digits = React.useMemo(() => {
    const arr = value.split("").slice(0, length);
    while (arr.length < length) arr.push("");
    return arr;
  }, [value, length]);

  function setDigitAt(index: number, digit: string) {
    const next = [...digits];
    next[index] = digit;
    onChange(next.join("").slice(0, length));
  }

  function handleChange(index: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    setDigitAt(index, digit);
    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (pasted.length > 0) {
      e.preventDefault();
      onChange(pasted);
    }
  }

  return (
    <div className="flex gap-2">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          disabled={disabled}
          aria-label={`Digit ${index + 1}`}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          className={cn(
            "h-12 w-10 rounded-md border border-border text-center text-lg font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
          )}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 12: Run it to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add components lib/validations
git commit -m "feat: add shared auth UI primitives, OTP input, and Zod validation schemas"
```

---

### Task 7: Signup flow

**Files:**
- Create: `lib/auth/signup.ts`
- Create: `app/(auth)/layout.tsx`
- Create: `app/(auth)/signup/page.tsx`
- Create: `app/(auth)/signup/signup-form.tsx`
- Create: `tests/integration/signup.test.ts`

**Interfaces:**
- Consumes: `createClient()` from `lib/supabase/client.ts` (Task 5); `signupSchema` from `lib/validations/auth.ts` (Task 6); `Button`, `Input`, `Label`, `FormError` (Task 6).
- Produces: `signUpUser(supabase: SupabaseClient, input: SignupInput): Promise<{ error: string | null }>` from `lib/auth/signup.ts` — used by the signup form and by integration tests.

- [ ] **Step 1: Write the failing integration test**

Create `tests/integration/signup.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient, createAnonClient } from "../helpers/admin-client";
import { signUpUser } from "@/lib/auth/signup";

const admin = createAdminClient();
const createdUserIds: string[] = [];

afterEach(async () => {
  for (const id of createdUserIds.splice(0)) {
    await admin.auth.admin.deleteUser(id);
  }
});

describe("signUpUser", () => {
  it("creates an unverified user and a matching profile row", async () => {
    const client = createAnonClient();
    const email = `signup-${Date.now()}@example.com`;

    const { error } = await signUpUser(client, {
      fullName: "Grace Hopper",
      email,
      password: "StrongPass123!",
    });
    expect(error).toBeNull();

    const { data: usersPage } = await admin.auth.admin.listUsers();
    const created = usersPage.users.find((u) => u.email === email);
    expect(created).toBeDefined();
    expect(created!.email_confirmed_at).toBeFalsy();
    createdUserIds.push(created!.id);

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("*")
      .eq("id", created!.id)
      .single();
    expect(profileError).toBeNull();
    expect(profile?.full_name).toBe("Grace Hopper");
  });

  it("returns a human-readable error for a duplicate email", async () => {
    const client = createAnonClient();
    const email = `signup-dup-${Date.now()}@example.com`;
    await signUpUser(client, { fullName: "First", email, password: "StrongPass123!" });

    const { data: usersPage } = await admin.auth.admin.listUsers();
    createdUserIds.push(usersPage.users.find((u) => u.email === email)!.id);

    const { error } = await signUpUser(client, {
      fullName: "Second",
      email,
      password: "StrongPass123!",
    });
    expect(error).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:integration`
Expected: FAIL — `lib/auth/signup.ts` doesn't exist.

- [ ] **Step 3: Write `lib/auth/signup.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SignupInput } from "@/lib/validations/auth";

export async function signUpUser(supabase: SupabaseClient, input: SignupInput) {
  const { error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { full_name: input.fullName } },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return { error: "An account with this email already exists." };
    }
    return { error: "Something went wrong creating your account. Please try again." };
  }

  return { error: null };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:integration`
Expected: PASS.

- [ ] **Step 5: Write `app/(auth)/layout.tsx`** (shared centered card layout for all auth pages)

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-background p-8 shadow-sm">
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Write `app/(auth)/signup/signup-form.tsx`**

```tsx
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, type SignupInput } from "@/lib/validations/auth";
import { signUpUser } from "@/lib/auth/signup";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form-error";

export function SignupForm() {
  const router = useRouter();
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) });

  async function onSubmit(values: SignupInput) {
    setSubmitError(null);
    const supabase = createClient();
    const { error } = await signUpUser(supabase, values);
    if (error) {
      setSubmitError(error);
      return;
    }
    router.push(`/verify?email=${encodeURIComponent(values.email)}`);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">Name</Label>
        <Input id="fullName" autoComplete="name" {...register("fullName")} />
        <FormError message={errors.fullName?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
        <FormError message={errors.email?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
        <FormError message={errors.password?.message} />
      </div>
      <FormError message={submitError ?? undefined} />
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 7: Write `app/(auth)/signup/page.tsx`**

```tsx
import Link from "next/link";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold">Create your FlowDo account</h1>
        <p className="text-sm text-muted-foreground">Find Your Flow.</p>
      </div>
      <SignupForm />
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 8: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 9: Commit**

```bash
git add lib/auth/signup.ts app/\(auth\) tests/integration/signup.test.ts
git commit -m "feat: add signup flow"
```

---

### Task 8: Verify (OTP) flow

**Files:**
- Create: `lib/auth/verify.ts`
- Create: `lib/auth/resend-cooldown.ts`
- Create: `lib/auth/resend-cooldown.test.ts`
- Create: `app/(auth)/verify/page.tsx`
- Create: `app/(auth)/verify/verify-form.tsx`
- Create: `tests/integration/verify.test.ts`

**Interfaces:**
- Consumes: `OtpInput` (Task 6), `createConfirmedTestUser`-style admin helpers (Task 4, but this task creates its own **unconfirmed** user), `createClient()` (Task 5).
- Produces: `verifyOtpCode(supabase: SupabaseClient, email: string, code: string): Promise<{ error: string | null }>` and `resendOtpCode(supabase: SupabaseClient, email: string): Promise<{ error: string | null }>` from `lib/auth/verify.ts`.
- Produces: `canResend(lastSentAt: number, now: number, cooldownMs?: number): boolean` from `lib/auth/resend-cooldown.ts`, used by the verify form and unit-tested directly.

- [ ] **Step 1: Write the failing cooldown test**

Create `lib/auth/resend-cooldown.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { canResend } from "./resend-cooldown";

describe("canResend", () => {
  it("blocks resend immediately after sending", () => {
    expect(canResend(1000, 1000)).toBe(false);
  });

  it("blocks resend before the cooldown elapses", () => {
    expect(canResend(1000, 1000 + 29_000, 30_000)).toBe(false);
  });

  it("allows resend once the cooldown elapses", () => {
    expect(canResend(1000, 1000 + 30_000, 30_000)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write `lib/auth/resend-cooldown.ts`**

```ts
export function canResend(lastSentAt: number, now: number, cooldownMs = 30_000): boolean {
  return now - lastSentAt >= cooldownMs;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Write the failing integration test**

Create `tests/integration/verify.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient, createAnonClient } from "../helpers/admin-client";
import { verifyOtpCode } from "@/lib/auth/verify";

const admin = createAdminClient();
const createdUserIds: string[] = [];

afterEach(async () => {
  for (const id of createdUserIds.splice(0)) {
    await admin.auth.admin.deleteUser(id);
  }
});

describe("verifyOtpCode", () => {
  it("rejects an incorrect code", async () => {
    const email = `verify-${Date.now()}@example.com`;
    const { data } = await admin.auth.admin.createUser({
      email,
      password: "StrongPass123!",
      email_confirm: false,
    });
    createdUserIds.push(data.user!.id);

    const client = createAnonClient();
    const { error } = await verifyOtpCode(client, email, "000000");
    expect(error).toBeTruthy();
  });

  it("accepts the correct code and confirms the account", async () => {
    const email = `verify-ok-${Date.now()}@example.com`;
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: "signup",
      email,
      password: "StrongPass123!",
    });
    createdUserIds.push(linkData.user!.id);
    const otp = linkData.properties!.email_otp;

    const client = createAnonClient();
    const { error } = await verifyOtpCode(client, email, otp);
    expect(error).toBeNull();

    const { data: refreshed } = await admin.auth.admin.getUserById(linkData.user!.id);
    expect(refreshed.user?.email_confirmed_at).toBeTruthy();
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm run test:integration`
Expected: FAIL — `lib/auth/verify.ts` doesn't exist.

- [ ] **Step 7: Write `lib/auth/verify.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export async function verifyOtpCode(supabase: SupabaseClient, email: string, code: string) {
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "signup" });
  if (error) {
    return { error: "That code is incorrect or has expired. Please try again." };
  }
  return { error: null };
}

export async function resendOtpCode(supabase: SupabaseClient, email: string) {
  const { error } = await supabase.auth.resend({ type: "signup", email });
  if (error) {
    return { error: "Couldn't resend the code. Please wait a moment and try again." };
  }
  return { error: null };
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npm run test:integration`
Expected: PASS.

- [ ] **Step 9: Write `app/(auth)/verify/verify-form.tsx`**

```tsx
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { OtpInput } from "@/components/auth/otp-input";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { verifyOtpCode, resendOtpCode } from "@/lib/auth/verify";
import { canResend } from "@/lib/auth/resend-cooldown";
import { createClient } from "@/lib/supabase/client";

const COOLDOWN_MS = 30_000;

export function VerifyForm({ email }: { email: string }) {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [isResending, setIsResending] = React.useState(false);
  const [lastSentAt, setLastSentAt] = React.useState(() => Date.now());
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const resendAvailable = canResend(lastSentAt, now, COOLDOWN_MS);
  const secondsRemaining = Math.max(0, Math.ceil((lastSentAt + COOLDOWN_MS - now) / 1000));

  async function handleVerify() {
    setError(null);
    setIsVerifying(true);
    const supabase = createClient();
    const { error } = await verifyOtpCode(supabase, email, code);
    setIsVerifying(false);
    if (error) {
      setError(error);
      return;
    }
    router.push("/app/dashboard");
  }

  async function handleResend() {
    setError(null);
    setIsResending(true);
    const supabase = createClient();
    const { error } = await resendOtpCode(supabase, email);
    setIsResending(false);
    if (error) {
      setError(error);
      return;
    }
    setLastSentAt(Date.now());
  }

  return (
    <div className="space-y-6">
      <OtpInput value={code} onChange={setCode} disabled={isVerifying} />
      <FormError message={error ?? undefined} />
      <Button className="w-full" disabled={code.length !== 6 || isVerifying} onClick={handleVerify}>
        {isVerifying ? "Verifying…" : "Verify"}
      </Button>
      <div className="text-center text-sm text-muted-foreground">
        {resendAvailable ? (
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50"
          >
            {isResending ? "Sending…" : "Resend code"}
          </button>
        ) : (
          <span>Resend available in {secondsRemaining}s</span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Write `app/(auth)/verify/page.tsx`**

```tsx
import Link from "next/link";
import { VerifyForm } from "./verify-form";

export default function VerifyPage({
  searchParams,
}: {
  searchParams: { email?: string };
}) {
  const email = searchParams.email ?? "";

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold">Check your email</h1>
        <p className="text-sm text-muted-foreground">
          We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>
        </p>
      </div>
      <VerifyForm email={email} />
      <p className="text-center text-sm text-muted-foreground">
        Wrong email?{" "}
        <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
          Start over
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 11: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 12: Commit**

```bash
git add lib/auth/verify.ts lib/auth/resend-cooldown.ts lib/auth/resend-cooldown.test.ts app/\(auth\)/verify tests/integration/verify.test.ts
git commit -m "feat: add 6-digit OTP email verification flow"
```

---

### Task 9: Login flow

**Files:**
- Create: `lib/auth/login.ts`
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/login/login-form.tsx`
- Create: `tests/integration/login.test.ts`

**Interfaces:**
- Consumes: `loginSchema` (Task 6), `createClient()` (Task 5).
- Produces: `logInUser(supabase: SupabaseClient, input: LoginInput): Promise<{ error: string | null; needsVerification: boolean }>` from `lib/auth/login.ts`.

- [ ] **Step 1: Write the failing integration test**

Create `tests/integration/login.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient, createAnonClient } from "../helpers/admin-client";
import { logInUser } from "@/lib/auth/login";

const admin = createAdminClient();
const createdUserIds: string[] = [];

afterEach(async () => {
  for (const id of createdUserIds.splice(0)) {
    await admin.auth.admin.deleteUser(id);
  }
});

describe("logInUser", () => {
  it("rejects an incorrect password", async () => {
    const email = `login-${Date.now()}@example.com`;
    const { data } = await admin.auth.admin.createUser({
      email,
      password: "CorrectPass123!",
      email_confirm: true,
    });
    createdUserIds.push(data.user!.id);

    const client = createAnonClient();
    const { error } = await logInUser(client, { email, password: "WrongPass123!" });
    expect(error).toBeTruthy();
  });

  it("flags an unverified account as needing verification", async () => {
    const email = `login-unverified-${Date.now()}@example.com`;
    const { data } = await admin.auth.admin.createUser({
      email,
      password: "CorrectPass123!",
      email_confirm: false,
    });
    createdUserIds.push(data.user!.id);

    const client = createAnonClient();
    const { error, needsVerification } = await logInUser(client, {
      email,
      password: "CorrectPass123!",
    });
    expect(error).toBeNull();
    expect(needsVerification).toBe(true);
  });

  it("logs in a verified user successfully", async () => {
    const email = `login-ok-${Date.now()}@example.com`;
    const { data } = await admin.auth.admin.createUser({
      email,
      password: "CorrectPass123!",
      email_confirm: true,
    });
    createdUserIds.push(data.user!.id);

    const client = createAnonClient();
    const { error, needsVerification } = await logInUser(client, {
      email,
      password: "CorrectPass123!",
    });
    expect(error).toBeNull();
    expect(needsVerification).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:integration`
Expected: FAIL — `lib/auth/login.ts` doesn't exist.

- [ ] **Step 3: Write `lib/auth/login.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LoginInput } from "@/lib/validations/auth";

export async function logInUser(supabase: SupabaseClient, input: LoginInput) {
  const { data, error } = await supabase.auth.signInWithPassword(input);

  if (error) {
    return { error: "Incorrect email or password.", needsVerification: false };
  }

  return { error: null, needsVerification: !data.user.email_confirmed_at };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:integration`
Expected: PASS.

- [ ] **Step 5: Write `app/(auth)/login/login-form.tsx`**

```tsx
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { logInUser } from "@/lib/auth/login";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form-error";
import Link from "next/link";

export function LoginForm() {
  const router = useRouter();
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setSubmitError(null);
    const supabase = createClient();
    const { error, needsVerification } = await logInUser(supabase, values);
    if (error) {
      setSubmitError(error);
      return;
    }
    if (needsVerification) {
      router.push(`/verify?email=${encodeURIComponent(getValues("email"))}`);
      return;
    }
    router.push("/app/dashboard");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
        <FormError message={errors.email?.message} />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot-password" className="text-sm text-primary underline-offset-4 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
        <FormError message={errors.password?.message} />
      </div>
      <FormError message={submitError ?? undefined} />
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Logging in…" : "Log in"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 6: Write `app/(auth)/login/page.tsx`**

```tsx
import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Find Your Flow.</p>
      </div>
      <LoginForm />
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 8: Commit**

```bash
git add lib/auth/login.ts app/\(auth\)/login tests/integration/login.test.ts
git commit -m "feat: add login flow with unverified-account redirect"
```

---

### Task 10: Forgot / reset password flow

**Files:**
- Create: `lib/auth/password.ts`
- Create: `app/(auth)/forgot-password/page.tsx`
- Create: `app/(auth)/forgot-password/forgot-password-form.tsx`
- Create: `app/(auth)/reset-password/page.tsx`
- Create: `app/(auth)/reset-password/reset-password-form.tsx`
- Create: `tests/integration/password.test.ts`

**Interfaces:**
- Consumes: `forgotPasswordSchema`, `resetPasswordSchema` (Task 6), `createClient()` (Task 5).
- Produces: `requestPasswordReset(supabase: SupabaseClient, email: string): Promise<{ error: null }>` (always null — never reveals whether the email exists) and `setNewPassword(supabase: SupabaseClient, password: string): Promise<{ error: string | null }>` from `lib/auth/password.ts`.

- [ ] **Step 1: Write the failing integration test**

Create `tests/integration/password.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient, createAnonClient } from "../helpers/admin-client";
import { setNewPassword } from "@/lib/auth/password";

const admin = createAdminClient();
const createdUserIds: string[] = [];

afterEach(async () => {
  for (const id of createdUserIds.splice(0)) {
    await admin.auth.admin.deleteUser(id);
  }
});

describe("setNewPassword", () => {
  it("updates the password so the old one stops working", async () => {
    const email = `reset-${Date.now()}@example.com`;
    const { data } = await admin.auth.admin.createUser({
      email,
      password: "OldPass123!",
      email_confirm: true,
    });
    createdUserIds.push(data.user!.id);

    const client = createAnonClient();
    await client.auth.signInWithPassword({ email, password: "OldPass123!" });

    const { error } = await setNewPassword(client, "NewPass123!");
    expect(error).toBeNull();

    const freshClient = createAnonClient();
    const { error: oldPasswordError } = await freshClient.auth.signInWithPassword({
      email,
      password: "OldPass123!",
    });
    expect(oldPasswordError).toBeTruthy();

    const { error: newPasswordError } = await freshClient.auth.signInWithPassword({
      email,
      password: "NewPass123!",
    });
    expect(newPasswordError).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:integration`
Expected: FAIL — `lib/auth/password.ts` doesn't exist.

- [ ] **Step 3: Write `lib/auth/password.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export async function requestPasswordReset(supabase: SupabaseClient, email: string) {
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/reset-password`,
  });
  // Never reveal whether the email exists: always resolve without an error.
  return { error: null };
}

export async function setNewPassword(supabase: SupabaseClient, password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: "Couldn't update your password. The reset link may have expired." };
  }
  return { error: null };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:integration`
Expected: PASS.

- [ ] **Step 5: Write `app/(auth)/forgot-password/forgot-password-form.tsx`**

```tsx
"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validations/auth";
import { requestPasswordReset } from "@/lib/auth/password";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form-error";

export function ForgotPasswordForm() {
  const [sent, setSent] = React.useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(values: ForgotPasswordInput) {
    const supabase = createClient();
    await requestPasswordReset(supabase, values.email);
    setSent(true);
  }

  if (sent) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        If an account exists for that email, we&apos;ve sent a password reset link.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
        <FormError message={errors.email?.message} />
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 6: Write `app/(auth)/forgot-password/page.tsx`**

```tsx
import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold">Reset your password</h1>
        <p className="text-sm text-muted-foreground">We&apos;ll email you a link to reset it.</p>
      </div>
      <ForgotPasswordForm />
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Back to login
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 7: Write `app/(auth)/reset-password/reset-password-form.tsx`**

```tsx
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validations/auth";
import { setNewPassword } from "@/lib/auth/password";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form-error";

export function ResetPasswordForm() {
  const router = useRouter();
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) });

  async function onSubmit(values: ResetPasswordInput) {
    setSubmitError(null);
    const supabase = createClient();
    const { error } = await setNewPassword(supabase, values.password);
    if (error) {
      setSubmitError(error);
      return;
    }
    router.push("/login");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
        <FormError message={errors.password?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          {...register("confirmPassword")}
        />
        <FormError message={errors.confirmPassword?.message} />
      </div>
      <FormError message={submitError ?? undefined} />
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 8: Write `app/(auth)/reset-password/page.tsx`**

```tsx
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold">Choose a new password</h1>
      </div>
      <ResetPasswordForm />
    </div>
  );
}
```

- [ ] **Step 9: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 10: Commit**

```bash
git add lib/auth/password.ts app/\(auth\)/forgot-password app/\(auth\)/reset-password tests/integration/password.test.ts
git commit -m "feat: add forgot/reset password flow"
```

---

### Task 11: Logout + settings (profile, security)

**Files:**
- Create: `lib/auth/logout.ts`
- Create: `lib/auth/profile.ts`
- Create: `app/app/settings/profile/page.tsx`
- Create: `app/app/settings/profile/profile-form.tsx`
- Create: `app/app/settings/security/page.tsx`
- Create: `app/app/settings/security/security-form.tsx`
- Create: `tests/integration/profile.test.ts`

**Interfaces:**
- Consumes: `createClient()` (Task 5), `createServerClient()` (Task 5), `setNewPassword` (Task 10).
- Produces: `logOutUser(supabase: SupabaseClient): Promise<void>` from `lib/auth/logout.ts`, used by the dashboard shell's user menu (Task 12).
- Produces: `updateProfile(supabase: SupabaseClient, userId: string, input: { fullName: string }): Promise<{ error: string | null }>` from `lib/auth/profile.ts`.

- [ ] **Step 1: Write the failing integration test**

Create `tests/integration/profile.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient, createAnonClient } from "../helpers/admin-client";
import { updateProfile } from "@/lib/auth/profile";

const admin = createAdminClient();
const createdUserIds: string[] = [];

afterEach(async () => {
  for (const id of createdUserIds.splice(0)) {
    await admin.auth.admin.deleteUser(id);
  }
});

describe("updateProfile", () => {
  it("updates the caller's own profile full_name", async () => {
    const email = `profile-${Date.now()}@example.com`;
    const { data } = await admin.auth.admin.createUser({
      email,
      password: "StrongPass123!",
      email_confirm: true,
    });
    createdUserIds.push(data.user!.id);

    const client = createAnonClient();
    await client.auth.signInWithPassword({ email, password: "StrongPass123!" });

    const { error } = await updateProfile(client, data.user!.id, { fullName: "Updated Name" });
    expect(error).toBeNull();

    const { data: profile } = await admin.from("profiles").select("full_name").eq("id", data.user!.id).single();
    expect(profile?.full_name).toBe("Updated Name");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:integration`
Expected: FAIL — `lib/auth/profile.ts` doesn't exist.

- [ ] **Step 3: Write `lib/auth/profile.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export async function updateProfile(
  supabase: SupabaseClient,
  userId: string,
  input: { fullName: string }
) {
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: input.fullName })
    .eq("id", userId);

  if (error) {
    return { error: "Couldn't update your profile. Please try again." };
  }
  return { error: null };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:integration`
Expected: PASS.

- [ ] **Step 5: Write `lib/auth/logout.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export async function logOutUser(supabase: SupabaseClient) {
  await supabase.auth.signOut();
}
```

- [ ] **Step 6: Write `app/app/settings/profile/profile-form.tsx`**

```tsx
"use client";
import * as React from "react";
import { updateProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form-error";

export function ProfileForm({
  userId,
  initialFullName,
  email,
}: {
  userId: string;
  initialFullName: string;
  email: string;
}) {
  const [fullName, setFullName] = React.useState(initialFullName);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);
    const supabase = createClient();
    const { error } = await updateProfile(supabase, userId, { fullName });
    setIsSubmitting(false);
    if (error) {
      setError(error);
      return;
    }
    setSuccess(true);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-sm space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} disabled />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fullName">Name</Label>
        <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <FormError message={error ?? undefined} />
      {success && <p className="text-sm text-primary">Profile updated.</p>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 7: Write `app/app/settings/profile/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Profile</h1>
      <ProfileForm userId={user.id} initialFullName={profile?.full_name ?? ""} email={user.email ?? ""} />
    </div>
  );
}
```

- [ ] **Step 8: Write `app/app/settings/security/security-form.tsx`**

```tsx
"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validations/auth";
import { setNewPassword } from "@/lib/auth/password";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form-error";

export function SecurityForm() {
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) });

  async function onSubmit(values: ResetPasswordInput) {
    setSubmitError(null);
    setSuccess(false);
    const supabase = createClient();
    const { error } = await setNewPassword(supabase, values.password);
    if (error) {
      setSubmitError(error);
      return;
    }
    setSuccess(true);
    reset();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-sm space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
        <FormError message={errors.password?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          {...register("confirmPassword")}
        />
        <FormError message={errors.confirmPassword?.message} />
      </div>
      <FormError message={submitError ?? undefined} />
      {success && <p className="text-sm text-primary">Password updated.</p>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 9: Write `app/app/settings/security/page.tsx`**

```tsx
import { SecurityForm } from "./security-form";

export default function SecuritySettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Security</h1>
      <SecurityForm />
    </div>
  );
}
```

- [ ] **Step 10: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 11: Commit**

```bash
git add lib/auth/logout.ts lib/auth/profile.ts app/app/settings tests/integration/profile.test.ts
git commit -m "feat: add logout, profile settings, and security settings"
```

---

### Task 12: Dashboard shell

**Files:**
- Create: `components/dashboard/sidebar.tsx`
- Create: `components/dashboard/mobile-nav.tsx`
- Create: `components/dashboard/user-menu.tsx`
- Create: `components/dashboard/empty-state.tsx`
- Create: `app/app/layout.tsx`
- Create: `app/app/dashboard/page.tsx`
- Create: `app/app/inbox/page.tsx`
- Create: `app/app/today/page.tsx`
- Create: `app/app/upcoming/page.tsx`
- Create: `app/app/completed/page.tsx`
- Create: `app/app/calendar/page.tsx`
- Create: `app/app/projects/page.tsx`
- Create: `app/app/analytics/page.tsx`
- Create: `app/app/settings/layout.tsx`
- Create: `components/dashboard/empty-state.test.tsx`

**Interfaces:**
- Consumes: `createClient()` server client (Task 5), `logOutUser` (Task 11).
- Produces: `<EmptyState icon, title, description, action?>` reused by every placeholder route.

- [ ] **Step 1: Write the failing empty state test**

Create `components/dashboard/empty-state.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renders a title and description", () => {
    render(<EmptyState icon={Inbox} title="No tasks yet" description="Create your first task to get started." />);
    expect(screen.getByText("No tasks yet")).toBeInTheDocument();
    expect(screen.getByText("Create your first task to get started.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — `components/dashboard/empty-state.tsx` doesn't exist.

- [ ] **Step 3: Write `components/dashboard/empty-state.tsx`**

```tsx
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
      <Icon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Write `components/dashboard/user-menu.tsx`**

```tsx
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { LogOut, Settings, User } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { logOutUser } from "@/lib/auth/logout";

export function UserMenu({ email }: { email: string }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await logOutUser(supabase);
    router.push("/login");
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-medium"
          aria-label="User menu"
        >
          {email.charAt(0).toUpperCase()}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="z-50 min-w-[200px] rounded-md border border-border bg-background p-1 shadow-md"
        >
          <div className="px-2 py-1.5 text-sm text-muted-foreground">{email}</div>
          <DropdownMenu.Item asChild>
            <Link
              href="/app/settings/profile"
              className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
            >
              <User className="h-4 w-4" /> Profile
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link
              href="/app/settings/security"
              className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
            >
              <Settings className="h-4 w-4" /> Security
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={handleLogout}
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-muted"
          >
            <LogOut className="h-4 w-4" /> Log out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
```

- [ ] **Step 6: Write the shared nav item list + `components/dashboard/sidebar.tsx`**

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  Calendar as CalendarIcon,
  CalendarDays,
  CheckCircle2,
  FolderKanban,
  BarChart3,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/inbox", label: "Inbox", icon: Inbox },
  { href: "/app/today", label: "Today", icon: CalendarIcon },
  { href: "/app/upcoming", label: "Upcoming", icon: CalendarDays },
  { href: "/app/completed", label: "Completed", icon: CheckCircle2 },
  { href: "/app/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/app/projects", label: "Projects", icon: FolderKanban },
  { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/app/settings/profile", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <nav className="hidden w-56 shrink-0 flex-col gap-1 border-r border-border p-4 md:flex">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname.startsWith(item.href.split("/").slice(0, 3).join("/"));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
              isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 7: Write `components/dashboard/mobile-nav.tsx`**

```tsx
"use client";
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { NAV_ITEMS } from "./sidebar";

export function MobileNav() {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="flex h-9 w-9 items-center justify-center rounded-md md:hidden" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col gap-1 bg-background p-4 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="font-semibold">FlowDo</Dialog.Title>
            <Dialog.Close asChild>
              <button aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 8: Write `app/app/layout.tsx`**

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/sidebar";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { UserMenu } from "@/components/dashboard/user-menu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <MobileNav />
            <span className="font-semibold">FlowDo</span>
          </div>
          <UserMenu email={user.email ?? ""} />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Write the placeholder route pages** (each an honest empty state, no fabricated data)

`app/app/dashboard/page.tsx`:

```tsx
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="text-sm text-muted-foreground">
        Your task overview will appear here once you start creating tasks.
      </p>
    </div>
  );
}
```

`app/app/inbox/page.tsx`:

```tsx
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";

export default function InboxPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Inbox</h1>
      <EmptyState icon={Inbox} title="Inbox is empty" description="Unassigned tasks will land here." />
    </div>
  );
}
```

`app/app/today/page.tsx`:

```tsx
import { Calendar } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";

export default function TodayPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Today</h1>
      <EmptyState icon={Calendar} title="Nothing due today" description="Tasks due today will show up here." />
    </div>
  );
}
```

`app/app/upcoming/page.tsx`:

```tsx
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";

export default function UpcomingPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Upcoming</h1>
      <EmptyState icon={CalendarDays} title="No upcoming tasks" description="Tasks due soon will show up here." />
    </div>
  );
}
```

`app/app/completed/page.tsx`:

```tsx
import { CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";

export default function CompletedPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Completed</h1>
      <EmptyState icon={CheckCircle2} title="No completed tasks yet" description="Tasks you finish will show up here." />
    </div>
  );
}
```

`app/app/calendar/page.tsx`:

```tsx
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Calendar</h1>
      <EmptyState icon={CalendarDays} title="Calendar view coming soon" description="Task scheduling by date arrives in Phase 3." />
    </div>
  );
}
```

`app/app/projects/page.tsx`:

```tsx
import { FolderKanban } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Projects</h1>
      <EmptyState icon={FolderKanban} title="No projects yet" description="Create a project to organize your tasks." />
    </div>
  );
}
```

`app/app/analytics/page.tsx`:

```tsx
import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Analytics</h1>
      <EmptyState icon={BarChart3} title="Not enough data yet" description="Productivity insights appear once you've completed some tasks." />
    </div>
  );
}
```

- [ ] **Step 10: Write `app/app/settings/layout.tsx`** (simple sub-nav between Profile/Security)

```tsx
import Link from "next/link";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b border-border pb-2 text-sm">
        <Link href="/app/settings/profile" className="font-medium hover:text-primary">
          Profile
        </Link>
        <Link href="/app/settings/security" className="font-medium hover:text-primary">
          Security
        </Link>
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 11: Verify build**

Run: `npm run build`
Expected: succeeds; all `/app/*` routes render.

- [ ] **Step 12: Commit**

```bash
git add components/dashboard app/app
git commit -m "feat: add responsive dashboard shell with nav, user menu, and empty-state routes"
```

---

### Task 13: Final verification pass, README, and manual setup docs

**Files:**
- Create: `README.md`
- Modify: (none — this task only verifies and documents)

**Interfaces:**
- None — this task consumes everything built in Tasks 1–12 and documents/verifies it as a whole.

- [ ] **Step 1: Run the full verification suite**

Run: `npm run lint && npm run typecheck && npm test && npm run test:integration && npm run build`
Expected: all five succeed with zero errors. If any fail, use `superpowers:systematic-debugging` to find root cause — do not patch symptoms.

- [ ] **Step 2: Manual smoke test against local Supabase**

With `npx supabase start` running and `npm run dev` running, in a browser:
1. Visit `/signup`, create an account.
2. Confirm redirect to `/verify`.
3. Fetch the OTP from the local mail catcher UI (URL printed by `supabase status` as "Mailpit URL" / "Inbucket URL", typically `http://127.0.0.1:54324`) and enter it.
4. Confirm redirect to `/app/dashboard`.
5. Visit `/app/settings/profile`, change the name, confirm it saves.
6. Visit `/app/settings/security`, change the password, confirm it saves.
7. Log out via the user menu, confirm redirect to `/login`.
8. Log back in with the new password, confirm dashboard access.
9. Visit `/forgot-password`, submit the email, fetch the reset link from the mail catcher, set a new password, confirm login with it works and the old password fails.
10. Confirm every sidebar route (Inbox, Today, Upcoming, Completed, Calendar, Projects, Analytics) renders its empty state without errors, on both desktop width and a mobile viewport (test the hamburger menu).

Record the outcome of each step; do not report Phase 1 complete if any step fails.

- [ ] **Step 3: Write `README.md`**

```markdown
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
4. Fill `.env.local` with the hosted project's URL, anon key, and service role key (Settings → API).

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
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup, testing, and security notes"
```

- [ ] **Step 5: Request code review**

Invoke `superpowers:requesting-code-review` against the full diff since the initial commit. Address all valid findings, then re-run Step 1's full verification suite before considering Phase 1 done.
