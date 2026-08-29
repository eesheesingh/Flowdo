# FlowDo Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build task and project CRUD, the four task views (Inbox/Today/Upcoming/Completed), search/filter/sort, drag-and-drop manual ordering, a project overview page, and real dashboard widgets — turning Phase 1's empty-state dashboard shell into a working task manager.

**Architecture:** No Server Actions — task/project mutations live in `lib/tasks/*.ts` and `lib/projects/*.ts`, calling the Supabase browser client directly, authorized entirely by Phase 1's existing RLS. Each view route is a Server Component that fetches its initial data (fast first paint, URL-search-param-aware), handing it to a Client Component that uses TanStack Query for all subsequent mutations and optimistic updates.

**Tech Stack:** Next.js App Router + TypeScript + Supabase (existing), React Hook Form + Zod (existing pattern), TanStack Query (installed but never wired up until now), `@dnd-kit/core` + `@dnd-kit/sortable` (new).

**Spec:** `docs/superpowers/specs/2026-08-28-flowdo-phase2-design.md`

## Global Constraints

- No Server Actions — mutations call the Supabase browser client directly from `lib/tasks/*.ts` / `lib/projects/*.ts`, matching every `lib/auth/*.ts` function from Phase 1.
- No new RLS policies or migrations beyond the one additive `projects.status` column — Phase 1's RLS is already hardened and adversarially reviewed; this phase adds application logic on top of it, not new authorization surface.
- Package manager is npm.
- Every Supabase client is `SupabaseClient<Database, "flowdo">` — never the bare default-schema type (established in Phase 1 after a real typecheck bug).
- Search/filter/sort state lives in the URL, read by both the Server Component (initial load) and the Client Component (interactive changes).
- Non-goals: subtasks, labels, calendar view, recurring tasks, activity log, notifications, analytics, realtime, project members/roles UI — none of this phase's tasks touch those tables.
- No fixed color/icon free-form pickers — a fixed 10-swatch palette and ~12 curated Lucide icons only.
- Commit messages must reference the Kaido work item, e.g. `FLOWDO-2: <message>`.

---

### Task 1: Project status migration

**Files:**
- Create: `supabase/migrations/0005_project_status.sql`
- Create: `tests/integration/project-status-migration.test.ts`

**Interfaces:**
- Produces: `flowdo.projects.status` column (`flowdo.project_status` enum: `ACTIVE` | `ARCHIVED`, default `ACTIVE`), consumed by Task 5's `archiveProject`/`listProjects`.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/project-status-migration.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { queryLocalDb } from "../helpers/pg-client";

describe("projects.status column", () => {
  it("exists with the expected enum values and defaults to ACTIVE", async () => {
    const columns = await queryLocalDb(
      `select column_name, column_default from information_schema.columns where table_schema = 'flowdo' and table_name = 'projects' and column_name = 'status'`
    );
    expect(columns.rows.length).toBe(1);
    expect(columns.rows[0].column_default).toContain("ACTIVE");

    const enumValues = await queryLocalDb(
      `select enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'project_status' order by enumsortorder`
    );
    expect(enumValues.rows.map((r) => r.enumlabel)).toEqual(["ACTIVE", "ARCHIVED"]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:integration`
Expected: FAIL — `flowdo.project_status` doesn't exist yet.

- [ ] **Step 3: Write `supabase/migrations/0005_project_status.sql`**

```sql
create type flowdo.project_status as enum ('ACTIVE', 'ARCHIVED');

alter table flowdo.projects
  add column status flowdo.project_status not null default 'ACTIVE';
```

- [ ] **Step 4: Apply and run tests**

Run: `npx supabase db reset && npm run test:integration`
Expected: PASS — all integration tests, including the new one.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0005_project_status.sql tests/integration/project-status-migration.test.ts
git commit -m "FLOWDO-2: add projects.status column for soft-archiving"
```

---

### Task 2: Foundational setup — QueryClientProvider, Database types, Zod schemas

**Files:**
- Create: `app/providers.tsx`
- Modify: `app/layout.tsx`
- Modify: `types/database.ts`
- Create: `lib/validations/tasks.ts`
- Create: `lib/validations/tasks.test.ts`

**Interfaces:**
- Produces: `<Providers>` wrapping the app in a `QueryClient`, consumed by every Client Component that uses TanStack Query from Task 6 onward.
- Produces: `Database["flowdo"]["Tables"]["tasks"]` and `Database["flowdo"]["Tables"]["projects"]` types, consumed by Tasks 3 and 5.
- Produces: `taskSchema`/`TaskInput`, `projectSchema`/`ProjectInput` from `lib/validations/tasks.ts`, consumed by Tasks 5, 8, and 12.

- [ ] **Step 1: Write `app/providers.tsx`**

```tsx
"use client";
import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 2: Wire it into `app/layout.tsx`**

Read the current file first — it wraps `{children}` directly in `<body>`. Change it to:

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

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
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Extend `types/database.ts`** with `tasks` and `projects` (replace the whole file)

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
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          parent_task_id: string | null;
          title: string;
          description: string | null;
          status: "TODO" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
          priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
          due_date: string | null;
          completed_at: string | null;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["flowdo"]["Tables"]["tasks"]["Row"]> & { user_id: string; title: string };
        Update: Partial<Database["flowdo"]["Tables"]["tasks"]["Row"]>;
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          color: string;
          icon: string | null;
          owner_id: string;
          status: "ACTIVE" | "ARCHIVED";
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["flowdo"]["Tables"]["projects"]["Row"]> & { owner_id: string; name: string };
        Update: Partial<Database["flowdo"]["Tables"]["projects"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
```

- [ ] **Step 4: Write the failing validation schema tests**

Create `lib/validations/tasks.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { taskSchema, projectSchema } from "./tasks";

describe("taskSchema", () => {
  it("requires only a title", () => {
    expect(taskSchema.safeParse({ title: "Buy milk" }).success).toBe(true);
  });

  it("rejects an empty title", () => {
    expect(taskSchema.safeParse({ title: "" }).success).toBe(false);
  });

  it("accepts a full task", () => {
    const result = taskSchema.safeParse({
      title: "Ship feature",
      description: "Write the plan and implement it",
      dueDate: "2026-09-01",
      priority: "HIGH",
      projectId: "11111111-1111-1111-1111-111111111111",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid priority", () => {
    expect(taskSchema.safeParse({ title: "x", priority: "SUPER_URGENT" }).success).toBe(false);
  });
});

describe("projectSchema", () => {
  it("requires a name, color, and icon", () => {
    expect(projectSchema.safeParse({ name: "Marketing", color: "#4F46E5", icon: "folder" }).success).toBe(true);
  });

  it("rejects a missing name", () => {
    expect(projectSchema.safeParse({ color: "#4F46E5", icon: "folder" }).success).toBe(false);
  });
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — `lib/validations/tasks.ts` doesn't exist.

- [ ] **Step 6: Write `lib/validations/tasks.ts`**

```ts
import { z } from "zod";

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  projectId: z.string().uuid().optional(),
});
export type TaskInput = z.infer<typeof taskSchema>;

export const projectSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().trim().optional(),
  color: z.string().min(1, "Pick a color"),
  icon: z.string().min(1, "Pick an icon"),
});
export type ProjectInput = z.infer<typeof projectSchema>;
```

- [ ] **Step 7: Run it to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 9: Commit**

```bash
git add app/providers.tsx app/layout.tsx types/database.ts lib/validations/tasks.ts lib/validations/tasks.test.ts
git commit -m "FLOWDO-2: add QueryClientProvider, extend Database types for tasks/projects, add Zod schemas"
```

---

### Task 3: Task data layer

**Files:**
- Create: `lib/tasks/date-ranges.ts`
- Create: `lib/tasks/tasks.ts`
- Create: `tests/integration/tasks.test.ts`

**Interfaces:**
- Produces: `getTodayRange(now?: Date): { start: string; end: string }` — pure function, UTC-day boundaries as ISO strings.
- Produces: `createTask(supabase, userId: string, input: TaskInput): Promise<{ data: TaskRow | null; error: string | null }>`.
- Produces: `updateTask(supabase, taskId: string, input: Partial<TaskInput>): Promise<{ data: TaskRow | null; error: string | null }>`.
- Produces: `deleteTask(supabase, taskId: string): Promise<{ error: string | null }>`.
- Produces: `completeTask(supabase, taskId: string): Promise<{ error: string | null }>` / `reopenTask(supabase, taskId: string): Promise<{ error: string | null }>`.
- Produces: `listTasks(supabase, filters: ListTasksFilters): Promise<{ data: TaskRow[] | null; error: string | null }>` where
  `ListTasksFilters = { projectId?: string | null; dueDate?: "today" | "upcoming" | "none"; excludeCompleted?: boolean; status?: TaskStatus; priority?: TaskPriority; search?: string; sort?: "due_date" | "priority" | "created_at" | "alphabetical" | "manual" }`.

- [ ] **Step 1: Write `lib/tasks/date-ranges.ts`** (no test-first here — trivial pure function, tested via Step 2's `listTasks` integration tests exercising it indirectly, plus a direct unit test)

```ts
export function getTodayRange(now: Date = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}
```

- [ ] **Step 2: Write a unit test for it**

Create `lib/tasks/date-ranges.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getTodayRange } from "./date-ranges";

describe("getTodayRange", () => {
  it("returns UTC midnight boundaries for the given day", () => {
    const { start, end } = getTodayRange(new Date("2026-03-15T14:30:00Z"));
    expect(start).toBe("2026-03-15T00:00:00.000Z");
    expect(end).toBe("2026-03-16T00:00:00.000Z");
  });

  it("rolls over correctly at month/year boundaries", () => {
    const { start, end } = getTodayRange(new Date("2026-12-31T23:59:00Z"));
    expect(start).toBe("2026-12-31T00:00:00.000Z");
    expect(end).toBe("2027-01-01T00:00:00.000Z");
  });
});
```

Run: `npm test`
Expected: PASS (no RED/GREEN needed for this one — it's a 6-line pure function written alongside its test; if you want to be strict, delete the implementation, confirm the test fails, then restore it).

- [ ] **Step 3: Write the failing integration test**

Create `tests/integration/tasks.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient } from "../helpers/admin-client";
import { createConfirmedTestUser } from "../helpers/test-user";
import { createTask, updateTask, deleteTask, completeTask, reopenTask, listTasks } from "@/lib/tasks/tasks";

const admin = createAdminClient();
const createdUserIds: string[] = [];

afterEach(async () => {
  for (const id of createdUserIds.splice(0)) {
    await admin.auth.admin.deleteUser(id);
  }
});

describe("createTask", () => {
  it("creates a task owned by the caller with sensible defaults", async () => {
    const owner = await createConfirmedTestUser(admin, "tasks-create@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const { data, error } = await createTask(owner.client, owner.userId, { title: "Buy milk" });
    expect(error).toBeNull();
    expect(data?.status).toBe("TODO");
    expect(data?.priority).toBe("MEDIUM");
    expect(data?.user_id).toBe(owner.userId);
  });

  it("a different user cannot see or modify the task (RLS through the application layer)", async () => {
    const owner = await createConfirmedTestUser(admin, "tasks-owner@example.com", "Password123!");
    const attacker = await createConfirmedTestUser(admin, "tasks-attacker@example.com", "Password123!");
    createdUserIds.push(owner.userId, attacker.userId);

    const { data: task } = await createTask(owner.client, owner.userId, { title: "Private task" });

    const { data: attackerView } = await listTasks(attacker.client, {});
    expect(attackerView?.find((t) => t.id === task!.id)).toBeUndefined();

    const { data: updated } = await updateTask(attacker.client, task!.id, { title: "hijacked" });
    expect(updated).toBeNull();
  });
});

describe("updateTask / deleteTask", () => {
  it("updates fields and can be deleted by the owner", async () => {
    const owner = await createConfirmedTestUser(admin, "tasks-update@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const { data: task } = await createTask(owner.client, owner.userId, { title: "Draft" });
    const { data: updated, error } = await updateTask(owner.client, task!.id, { title: "Final", priority: "HIGH" });
    expect(error).toBeNull();
    expect(updated?.title).toBe("Final");
    expect(updated?.priority).toBe("HIGH");

    const { error: deleteError } = await deleteTask(owner.client, task!.id);
    expect(deleteError).toBeNull();

    const { data: afterDelete } = await listTasks(owner.client, {});
    expect(afterDelete?.find((t) => t.id === task!.id)).toBeUndefined();
  });
});

describe("completeTask / reopenTask", () => {
  it("sets and clears completed_at and status", async () => {
    const owner = await createConfirmedTestUser(admin, "tasks-complete@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const { data: task } = await createTask(owner.client, owner.userId, { title: "Finish report" });
    const { error: completeError } = await completeTask(owner.client, task!.id);
    expect(completeError).toBeNull();

    const { data: afterComplete } = await listTasks(owner.client, { status: "COMPLETED" });
    const completed = afterComplete?.find((t) => t.id === task!.id);
    expect(completed?.status).toBe("COMPLETED");
    expect(completed?.completed_at).not.toBeNull();

    const { error: reopenError } = await reopenTask(owner.client, task!.id);
    expect(reopenError).toBeNull();

    const { data: afterReopen } = await listTasks(owner.client, { status: "TODO" });
    const reopened = afterReopen?.find((t) => t.id === task!.id);
    expect(reopened?.status).toBe("TODO");
    expect(reopened?.completed_at).toBeNull();
  });
});

describe("listTasks filters", () => {
  it("filters by projectId null (Inbox) vs a specific project", async () => {
    const owner = await createConfirmedTestUser(admin, "tasks-inbox@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const { data: project } = await owner.client
      .from("projects")
      .insert({ owner_id: owner.userId, name: "Website", color: "#4F46E5" })
      .select()
      .single();

    await createTask(owner.client, owner.userId, { title: "No project" });
    await createTask(owner.client, owner.userId, { title: "In project", projectId: project!.id });

    const { data: inboxTasks } = await listTasks(owner.client, { projectId: null });
    expect(inboxTasks?.map((t) => t.title)).toEqual(["No project"]);

    const { data: projectTasks } = await listTasks(owner.client, { projectId: project!.id });
    expect(projectTasks?.map((t) => t.title)).toEqual(["In project"]);
  });

  it("filters by dueDate today/upcoming and excludes completed", async () => {
    const owner = await createConfirmedTestUser(admin, "tasks-duedate@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const today = new Date().toISOString();
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: todayTask } = await createTask(owner.client, owner.userId, { title: "Due today", dueDate: today });
    await createTask(owner.client, owner.userId, { title: "Due next week", dueDate: nextWeek });
    await completeTask(owner.client, todayTask!.id);
    const { data: anotherToday } = await createTask(owner.client, owner.userId, { title: "Also today", dueDate: today });

    const { data: todayResults } = await listTasks(owner.client, { dueDate: "today", excludeCompleted: true });
    expect(todayResults?.map((t) => t.id)).toEqual([anotherToday!.id]);

    const { data: upcomingResults } = await listTasks(owner.client, { dueDate: "upcoming" });
    expect(upcomingResults?.map((t) => t.title)).toEqual(["Due next week"]);
  });

  it("searches by title/description and sorts alphabetically", async () => {
    const owner = await createConfirmedTestUser(admin, "tasks-search@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    await createTask(owner.client, owner.userId, { title: "Zebra task" });
    await createTask(owner.client, owner.userId, { title: "Apple task", description: "buy fruit" });
    await createTask(owner.client, owner.userId, { title: "Unrelated" });

    const { data: searchResults } = await listTasks(owner.client, { search: "fruit" });
    expect(searchResults?.map((t) => t.title)).toEqual(["Apple task"]);

    const { data: sorted } = await listTasks(owner.client, { sort: "alphabetical" });
    expect(sorted?.map((t) => t.title)).toEqual(["Apple task", "Unrelated", "Zebra task"]);
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npm run test:integration`
Expected: FAIL — `lib/tasks/tasks.ts` doesn't exist.

- [ ] **Step 5: Write `lib/tasks/tasks.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getTodayRange } from "./date-ranges";

type TaskRow = Database["flowdo"]["Tables"]["tasks"]["Row"];
type TaskStatus = TaskRow["status"];
type TaskPriority = TaskRow["priority"];
type Client = SupabaseClient<Database, "flowdo">;

export interface TaskInputLike {
  title: string;
  description?: string;
  dueDate?: string;
  priority?: TaskPriority;
  projectId?: string;
}

export async function createTask(supabase: Client, userId: string, input: TaskInputLike) {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      title: input.title,
      description: input.description ?? null,
      due_date: input.dueDate ?? null,
      priority: input.priority ?? "MEDIUM",
      project_id: input.projectId ?? null,
    })
    .select()
    .single();

  if (error) return { data: null, error: "Couldn't create task. Please try again." };
  return { data, error: null };
}

export async function updateTask(
  supabase: Client,
  taskId: string,
  input: Partial<TaskInputLike> & { status?: TaskStatus }
) {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.dueDate !== undefined) patch.due_date = input.dueDate;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.projectId !== undefined) patch.project_id = input.projectId;
  if (input.status !== undefined) patch.status = input.status;

  const { data, error } = await supabase.from("tasks").update(patch).eq("id", taskId).select().single();
  if (error) return { data: null, error: "Couldn't update task. Please try again." };
  return { data, error: null };
}

export async function deleteTask(supabase: Client, taskId: string) {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) return { error: "Couldn't delete task. Please try again." };
  return { error: null };
}

export async function completeTask(supabase: Client, taskId: string) {
  const { error } = await supabase
    .from("tasks")
    .update({ status: "COMPLETED", completed_at: new Date().toISOString() })
    .eq("id", taskId);
  if (error) return { error: "Couldn't complete task. Please try again." };
  return { error: null };
}

export async function reopenTask(supabase: Client, taskId: string) {
  const { error } = await supabase.from("tasks").update({ status: "TODO", completed_at: null }).eq("id", taskId);
  if (error) return { error: "Couldn't reopen task. Please try again." };
  return { error: null };
}

export async function updateTaskPosition(supabase: Client, taskId: string, position: number) {
  const { error } = await supabase.from("tasks").update({ position }).eq("id", taskId);
  if (error) return { error: "Couldn't reorder task. Please try again." };
  return { error: null };
}

export interface ListTasksFilters {
  projectId?: string | null;
  dueDate?: "today" | "upcoming" | "none";
  excludeCompleted?: boolean;
  status?: TaskStatus;
  priority?: TaskPriority;
  search?: string;
  sort?: "due_date" | "priority" | "created_at" | "alphabetical" | "manual";
}

export async function listTasks(supabase: Client, filters: ListTasksFilters) {
  let query = supabase.from("tasks").select("*");

  if (filters.projectId !== undefined) {
    query = filters.projectId === null ? query.is("project_id", null) : query.eq("project_id", filters.projectId);
  }

  if (filters.dueDate === "today") {
    const { start, end } = getTodayRange();
    query = query.gte("due_date", start).lt("due_date", end);
  } else if (filters.dueDate === "upcoming") {
    const { end } = getTodayRange();
    query = query.gte("due_date", end);
  } else if (filters.dueDate === "none") {
    query = query.is("due_date", null);
  }

  if (filters.excludeCompleted) {
    query = query.neq("status", "COMPLETED");
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.priority) {
    query = query.eq("priority", filters.priority);
  }
  if (filters.search) {
    // Commas would break PostgREST's or() filter-string syntax; strip them.
    // A literal "%" in the search term just becomes an (harmless) extra
    // ilike wildcard, not a security concern - PostgREST parameterizes values.
    const safeSearch = filters.search.replace(/,/g, "");
    query = query.or(`title.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%`);
  }

  // Postgres enums sort by declaration order, so priority ascending/descending
  // is meaningful: flowdo.task_priority is declared LOW, MEDIUM, HIGH, URGENT.
  switch (filters.sort) {
    case "priority":
      query = query.order("priority", { ascending: false });
      break;
    case "alphabetical":
      query = query.order("title", { ascending: true });
      break;
    case "created_at":
      query = query.order("created_at", { ascending: false });
      break;
    case "due_date":
      query = query.order("due_date", { ascending: true, nullsFirst: false });
      break;
    default:
      query = query.order("position", { ascending: true });
  }

  const { data, error } = await query;
  if (error) return { data: null, error: "Couldn't load tasks. Please try again." };
  return { data: data as TaskRow[], error: null };
}
```

- [ ] **Step 6: Run it to verify it passes**

Run: `npm run test:integration`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/tasks/date-ranges.ts lib/tasks/date-ranges.test.ts lib/tasks/tasks.ts tests/integration/tasks.test.ts
git commit -m "FLOWDO-2: add task data layer (CRUD, complete/reopen, filtered listing)"
```

---

### Task 4: Reorder pure function

**Files:**
- Create: `lib/tasks/reorder.ts`
- Create: `lib/tasks/reorder.test.ts`

**Interfaces:**
- Produces: `calculateNewPosition(prevPosition: number | null, nextPosition: number | null): number`, consumed by Task 9's drag-and-drop handler.

- [ ] **Step 1: Write the failing test**

Create `lib/tasks/reorder.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { calculateNewPosition } from "./reorder";

describe("calculateNewPosition", () => {
  it("returns the midpoint between two neighbors", () => {
    expect(calculateNewPosition(10, 20)).toBe(15);
  });

  it("returns a value below the only following item when dropped at the start", () => {
    expect(calculateNewPosition(null, 10)).toBe(0);
  });

  it("returns a value above the only preceding item when dropped at the end", () => {
    expect(calculateNewPosition(10, null)).toBe(20);
  });

  it("returns 0 when the list is empty (no neighbors at all)", () => {
    expect(calculateNewPosition(null, null)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — `lib/tasks/reorder.ts` doesn't exist.

- [ ] **Step 3: Write `lib/tasks/reorder.ts`**

```ts
export function calculateNewPosition(prevPosition: number | null, nextPosition: number | null): number {
  if (prevPosition === null && nextPosition === null) return 0;
  if (prevPosition === null) return nextPosition! - 10;
  if (nextPosition === null) return prevPosition + 10;
  return (prevPosition + nextPosition) / 2;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/tasks/reorder.ts lib/tasks/reorder.test.ts
git commit -m "FLOWDO-2: add pure position-calculation function for drag-and-drop reordering"
```

---

### Task 5: Project data layer + color/icon constants

**Files:**
- Create: `lib/constants/project-colors.ts`
- Create: `lib/constants/project-icons.ts`
- Create: `lib/projects/projects.ts`
- Create: `tests/integration/projects.test.ts`

**Interfaces:**
- Produces: `PROJECT_COLORS: { name: string; value: string }[]` and `PROJECT_ICONS: { name: string; icon: LucideIcon }[]`, consumed by Task 12's project form.
- Produces: `createProject`, `updateProject`, `archiveProject`, `listProjects`, `getProject` from `lib/projects/projects.ts`, consumed by Task 12.

- [ ] **Step 1: Write `lib/constants/project-colors.ts`**

```ts
export const PROJECT_COLORS = [
  { name: "Indigo", value: "#4F46E5" },
  { name: "Blue", value: "#2563EB" },
  { name: "Cyan", value: "#0891B2" },
  { name: "Teal", value: "#0D9488" },
  { name: "Green", value: "#16A34A" },
  { name: "Amber", value: "#D97706" },
  { name: "Orange", value: "#EA580C" },
  { name: "Red", value: "#DC2626" },
  { name: "Pink", value: "#DB2777" },
  { name: "Purple", value: "#9333EA" },
] as const;
```

- [ ] **Step 2: Write `lib/constants/project-icons.ts`**

```ts
import {
  Folder,
  Briefcase,
  Rocket,
  Home,
  Heart,
  BookOpen,
  Code,
  Palette,
  ShoppingCart,
  Plane,
  DollarSign,
  Users,
  type LucideIcon,
} from "lucide-react";

export const PROJECT_ICONS: { name: string; icon: LucideIcon }[] = [
  { name: "folder", icon: Folder },
  { name: "briefcase", icon: Briefcase },
  { name: "rocket", icon: Rocket },
  { name: "home", icon: Home },
  { name: "heart", icon: Heart },
  { name: "book-open", icon: BookOpen },
  { name: "code", icon: Code },
  { name: "palette", icon: Palette },
  { name: "shopping-cart", icon: ShoppingCart },
  { name: "plane", icon: Plane },
  { name: "dollar-sign", icon: DollarSign },
  { name: "users", icon: Users },
];

export function getProjectIcon(name: string | null): LucideIcon {
  return PROJECT_ICONS.find((i) => i.name === name)?.icon ?? Folder;
}
```

- [ ] **Step 3: Write the failing integration test**

Create `tests/integration/projects.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient } from "../helpers/admin-client";
import { createConfirmedTestUser } from "../helpers/test-user";
import { createProject, updateProject, archiveProject, listProjects, getProject } from "@/lib/projects/projects";
import { createTask, listTasks } from "@/lib/tasks/tasks";

const admin = createAdminClient();
const createdUserIds: string[] = [];

afterEach(async () => {
  for (const id of createdUserIds.splice(0)) {
    await admin.auth.admin.deleteUser(id);
  }
});

describe("createProject / updateProject", () => {
  it("creates a project owned by the caller and can update it", async () => {
    const owner = await createConfirmedTestUser(admin, "projects-create@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const { data, error } = await createProject(owner.client, owner.userId, {
      name: "Website Redesign",
      color: "#4F46E5",
      icon: "folder",
    });
    expect(error).toBeNull();
    expect(data?.status).toBe("ACTIVE");

    const { data: updated, error: updateError } = await updateProject(owner.client, data!.id, { name: "Website v2" });
    expect(updateError).toBeNull();
    expect(updated?.name).toBe("Website v2");
  });

  it("a different user cannot see or modify the project (RLS through the application layer)", async () => {
    const owner = await createConfirmedTestUser(admin, "projects-owner@example.com", "Password123!");
    const attacker = await createConfirmedTestUser(admin, "projects-attacker@example.com", "Password123!");
    createdUserIds.push(owner.userId, attacker.userId);

    const { data: project } = await createProject(owner.client, owner.userId, {
      name: "Private project",
      color: "#4F46E5",
      icon: "folder",
    });

    const { data: attackerView } = await listProjects(attacker.client);
    expect(attackerView?.find((p) => p.id === project!.id)).toBeUndefined();
  });
});

describe("archiveProject / listProjects", () => {
  it("hides an archived project from listProjects but keeps its tasks queryable", async () => {
    const owner = await createConfirmedTestUser(admin, "projects-archive@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const { data: project } = await createProject(owner.client, owner.userId, {
      name: "Old project",
      color: "#4F46E5",
      icon: "folder",
    });
    await createTask(owner.client, owner.userId, { title: "Task in old project", projectId: project!.id });

    const { error } = await archiveProject(owner.client, project!.id);
    expect(error).toBeNull();

    const { data: activeProjects } = await listProjects(owner.client);
    expect(activeProjects?.find((p) => p.id === project!.id)).toBeUndefined();

    const { data: allProjects } = await listProjects(owner.client, { includeArchived: true });
    expect(allProjects?.find((p) => p.id === project!.id)?.status).toBe("ARCHIVED");

    const { data: directFetch } = await getProject(owner.client, project!.id);
    expect(directFetch?.id).toBe(project!.id);

    const { data: tasksInProject } = await listTasks(owner.client, { projectId: project!.id });
    expect(tasksInProject?.map((t) => t.title)).toEqual(["Task in old project"]);
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npm run test:integration`
Expected: FAIL — `lib/projects/projects.ts` doesn't exist.

- [ ] **Step 5: Write `lib/projects/projects.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database, "flowdo">;

export interface ProjectInputLike {
  name: string;
  description?: string;
  color: string;
  icon: string;
}

export async function createProject(supabase: Client, ownerId: string, input: ProjectInputLike) {
  const { data, error } = await supabase
    .from("projects")
    .insert({
      owner_id: ownerId,
      name: input.name,
      description: input.description ?? null,
      color: input.color,
      icon: input.icon,
    })
    .select()
    .single();
  if (error) return { data: null, error: "Couldn't create project. Please try again." };
  return { data, error: null };
}

export async function updateProject(supabase: Client, projectId: string, input: Partial<ProjectInputLike>) {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.color !== undefined) patch.color = input.color;
  if (input.icon !== undefined) patch.icon = input.icon;

  const { data, error } = await supabase.from("projects").update(patch).eq("id", projectId).select().single();
  if (error) return { data: null, error: "Couldn't update project. Please try again." };
  return { data, error: null };
}

export async function archiveProject(supabase: Client, projectId: string) {
  const { error } = await supabase.from("projects").update({ status: "ARCHIVED" }).eq("id", projectId);
  if (error) return { error: "Couldn't archive project. Please try again." };
  return { error: null };
}

export async function listProjects(supabase: Client, options: { includeArchived?: boolean } = {}) {
  let query = supabase.from("projects").select("*").order("created_at", { ascending: true });
  if (!options.includeArchived) {
    query = query.eq("status", "ACTIVE");
  }
  const { data, error } = await query;
  if (error) return { data: null, error: "Couldn't load projects. Please try again." };
  return { data, error: null };
}

export async function getProject(supabase: Client, projectId: string) {
  const { data, error } = await supabase.from("projects").select("*").eq("id", projectId).single();
  if (error) return { data: null, error: "Project not found." };
  return { data, error: null };
}
```

- [ ] **Step 6: Run it to verify it passes**

Run: `npm run test:integration`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/constants/project-colors.ts lib/constants/project-icons.ts lib/projects/projects.ts tests/integration/projects.test.ts
git commit -m "FLOWDO-2: add project data layer (CRUD, soft-archive) and color/icon constants"
```

---

### Task 6: Shared TaskRow + TaskList components

**Files:**
- Create: `components/tasks/task-row.tsx`
- Create: `components/tasks/task-list.tsx`
- Create: `components/tasks/task-row.test.tsx`

**Interfaces:**
- Consumes: `TaskRow` type (Task 2), `completeTask`/`reopenTask` (Task 3).
- Produces: `<TaskRow task, onOpen, onToggleComplete>` and `<TaskList tasks, onOpenTask, onToggleComplete, emptyTitle, emptyDescription>`, consumed by Tasks 7, 9, 11.

- [ ] **Step 1: Write the failing component test**

Create `components/tasks/task-row.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskRow } from "./task-row";

const baseTask = {
  id: "1",
  user_id: "u1",
  project_id: null,
  parent_task_id: null,
  title: "Write report",
  description: null,
  status: "TODO" as const,
  priority: "MEDIUM" as const,
  due_date: null,
  completed_at: null,
  position: 0,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("TaskRow", () => {
  it("renders the title and calls onOpen when clicked", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<TaskRow task={baseTask} onOpen={onOpen} onToggleComplete={vi.fn()} />);
    await user.click(screen.getByText("Write report"));
    expect(onOpen).toHaveBeenCalledWith(baseTask);
  });

  it("calls onToggleComplete when the checkbox is clicked, without opening the task", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onToggleComplete = vi.fn();
    render(<TaskRow task={baseTask} onOpen={onOpen} onToggleComplete={onToggleComplete} />);
    await user.click(screen.getByRole("checkbox"));
    expect(onToggleComplete).toHaveBeenCalledWith(baseTask);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("shows a checked checkbox for a completed task", () => {
    render(
      <TaskRow
        task={{ ...baseTask, status: "COMPLETED", completed_at: "2026-01-02T00:00:00.000Z" }}
        onOpen={vi.fn()}
        onToggleComplete={vi.fn()}
      />
    );
    expect(screen.getByRole("checkbox")).toBeChecked();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — `components/tasks/task-row.tsx` doesn't exist.

- [ ] **Step 3: Write `components/tasks/task-row.tsx`**

```tsx
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type TaskRowData = Database["flowdo"]["Tables"]["tasks"]["Row"];

const PRIORITY_LABEL: Record<TaskRowData["priority"], string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export function TaskRow({
  task,
  onOpen,
  onToggleComplete,
}: {
  task: TaskRowData;
  onOpen: (task: TaskRowData) => void;
  onToggleComplete: (task: TaskRowData) => void;
}) {
  const isCompleted = task.status === "COMPLETED";

  return (
    <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2 hover:bg-muted">
      <input
        type="checkbox"
        role="checkbox"
        checked={isCompleted}
        onChange={(e) => {
          e.stopPropagation();
          onToggleComplete(task);
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label={isCompleted ? "Reopen task" : "Complete task"}
        className="h-4 w-4 shrink-0 rounded border-border"
      />
      <button
        type="button"
        onClick={() => onOpen(task)}
        className={cn(
          "flex-1 truncate text-left text-sm",
          isCompleted && "text-muted-foreground line-through"
        )}
      >
        {task.title}
      </button>
      {task.priority !== "MEDIUM" && (
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
            task.priority === "URGENT" && "bg-destructive/10 text-destructive",
            task.priority === "HIGH" && "bg-orange-500/10 text-orange-600",
            task.priority === "LOW" && "bg-muted text-muted-foreground"
          )}
        >
          {PRIORITY_LABEL[task.priority]}
        </span>
      )}
      {task.due_date && (
        <span className="shrink-0 text-xs text-muted-foreground">
          {new Date(task.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Write `components/tasks/task-list.tsx`** (no drag-and-drop yet — Task 9 adds it)

```tsx
import { TaskRow } from "./task-row";
import { EmptyState } from "@/components/dashboard/empty-state";
import { CheckCircle2 } from "lucide-react";
import type { Database } from "@/types/database";

type TaskRowData = Database["flowdo"]["Tables"]["tasks"]["Row"];

export function TaskList({
  tasks,
  onOpenTask,
  onToggleComplete,
  emptyTitle,
  emptyDescription,
}: {
  tasks: TaskRowData[];
  onOpenTask: (task: TaskRowData) => void;
  onToggleComplete: (task: TaskRowData) => void;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (tasks.length === 0) {
    return <EmptyState icon={CheckCircle2} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} onOpen={onOpenTask} onToggleComplete={onToggleComplete} />
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 7: Commit**

```bash
git add components/tasks/task-row.tsx components/tasks/task-list.tsx components/tasks/task-row.test.tsx
git commit -m "FLOWDO-2: add shared TaskRow/TaskList components with complete/reopen toggle"
```

---

### Task 7: Quick-add bar

**Files:**
- Create: `components/tasks/quick-add.tsx`
- Create: `components/tasks/quick-add.test.tsx`

**Interfaces:**
- Consumes: `createTask` (Task 3).
- Produces: `<QuickAdd onCreate: (title: string) => Promise<void>>`, consumed by Task 11's task-view.

- [ ] **Step 1: Write the failing component test**

Create `components/tasks/quick-add.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuickAdd } from "./quick-add";

describe("QuickAdd", () => {
  it("calls onCreate with the typed title and clears the input on Enter", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<QuickAdd onCreate={onCreate} />);

    const input = screen.getByPlaceholderText(/add a task/i);
    await user.type(input, "Buy milk{Enter}");

    expect(onCreate).toHaveBeenCalledWith("Buy milk");
    expect(input).toHaveValue("");
  });

  it("does not call onCreate for an empty/whitespace-only title", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<QuickAdd onCreate={onCreate} />);

    const input = screen.getByPlaceholderText(/add a task/i);
    await user.type(input, "   {Enter}");

    expect(onCreate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — `components/tasks/quick-add.tsx` doesn't exist.

- [ ] **Step 3: Write `components/tasks/quick-add.tsx`**

```tsx
"use client";
import * as React from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";

export function QuickAdd({ onCreate }: { onCreate: (title: string) => Promise<void> }) {
  const [title, setTitle] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  async function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const trimmed = title.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    await onCreate(trimmed);
    setTitle("");
    setIsSubmitting(false);
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2">
      <Plus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a task, press Enter…"
        disabled={isSubmitting}
        className="border-none px-0 shadow-none focus-visible:ring-0"
      />
    </div>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/tasks/quick-add.tsx components/tasks/quick-add.test.tsx
git commit -m "FLOWDO-2: add quick-add bar for fast title-only task creation"
```

---

### Task 8: Task detail panel

**Files:**
- Create: `components/tasks/task-detail-panel.tsx`
- Create: `components/tasks/task-detail-panel.test.tsx`

**Interfaces:**
- Consumes: `taskSchema`/`TaskInput` (Task 2), `updateTask`/`deleteTask` (Task 3), `listProjects` (Task 5).
- Produces: `<TaskDetailPanel task, projects, open, onOpenChange, onSave, onDelete>`, consumed by Task 11's task-view.

- [ ] **Step 1: Write the failing component test**

Create `components/tasks/task-detail-panel.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskDetailPanel } from "./task-detail-panel";

const baseTask = {
  id: "1",
  user_id: "u1",
  project_id: null,
  parent_task_id: null,
  title: "Write report",
  description: "Quarterly numbers",
  status: "TODO" as const,
  priority: "MEDIUM" as const,
  due_date: null,
  completed_at: null,
  position: 0,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("TaskDetailPanel", () => {
  it("prefills the form from the task and calls onSave with edited values", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <TaskDetailPanel
        task={baseTask}
        projects={[]}
        open={true}
        onOpenChange={vi.fn()}
        onSave={onSave}
        onDelete={vi.fn()}
      />
    );

    const titleInput = screen.getByLabelText(/title/i);
    expect(titleInput).toHaveValue("Write report");

    await user.clear(titleInput);
    await user.type(titleInput, "Write final report");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(onSave).toHaveBeenCalledWith(
      "1",
      expect.objectContaining({ title: "Write final report" })
    );
  });

  it("calls onDelete when the delete button is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <TaskDetailPanel
        task={baseTask}
        projects={[]}
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        onDelete={onDelete}
      />
    );
    await user.click(screen.getByRole("button", { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith("1");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — `components/tasks/task-detail-panel.tsx` doesn't exist.

- [ ] **Step 3: Write `components/tasks/task-detail-panel.tsx`**

```tsx
"use client";
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { taskSchema, type TaskInput } from "@/lib/validations/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form-error";
import type { Database } from "@/types/database";

type TaskRowData = Database["flowdo"]["Tables"]["tasks"]["Row"];
type ProjectRowData = Database["flowdo"]["Tables"]["projects"]["Row"];

export function TaskDetailPanel({
  task,
  projects,
  open,
  onOpenChange,
  onSave,
  onDelete,
}: {
  task: TaskRowData;
  projects: ProjectRowData[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (taskId: string, input: TaskInput) => Promise<void>;
  onDelete: (taskId: string) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TaskInput>({
    resolver: zodResolver(taskSchema),
    values: {
      title: task.title,
      description: task.description ?? undefined,
      dueDate: task.due_date ?? undefined,
      priority: task.priority,
      projectId: task.project_id ?? undefined,
    },
  });

  async function onSubmit(values: TaskInput) {
    await onSave(task.id, values);
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col gap-4 overflow-y-auto bg-background p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">Task details</Dialog.Title>
            <Dialog.Close asChild>
              <button aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" {...register("title")} />
              <FormError message={errors.title?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                {...register("description")}
                rows={4}
                className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due date</Label>
                <Input id="dueDate" type="date" {...register("dueDate")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <select
                  id="priority"
                  {...register("priority")}
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="projectId">Project</Label>
              <select
                id="projectId"
                {...register("projectId")}
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="">No project (Inbox)</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-auto flex items-center justify-between pt-4">
              <Button type="button" variant="ghost" onClick={() => onDelete(task.id)} className="text-destructive">
                Delete
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add components/tasks/task-detail-panel.tsx components/tasks/task-detail-panel.test.tsx
git commit -m "FLOWDO-2: add task detail slide-over panel with full edit form"
```

---

### Task 9: Drag-and-drop reordering

**Files:**
- Modify: `package.json` (add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`)
- Modify: `components/tasks/task-list.tsx`
- Create: `components/tasks/task-list.test.tsx`

**Interfaces:**
- Consumes: `calculateNewPosition` (Task 4).
- Produces: `<TaskList tasks, onOpenTask, onToggleComplete, onReorder?: (taskId: string, newPosition: number) => void, emptyTitle, emptyDescription>` — `onReorder` is optional; when omitted (e.g. the Completed view), no drag handles render.

- [ ] **Step 1: Install the dependencies**

```bash
npm install @dnd-kit/core@^6.1.0 @dnd-kit/sortable@^8.0.0 @dnd-kit/utilities@^3.2.2
```

- [ ] **Step 2: Write the failing test**

Create `components/tasks/task-list.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TaskList } from "./task-list";

const tasks = [
  {
    id: "1",
    user_id: "u1",
    project_id: null,
    parent_task_id: null,
    title: "First",
    description: null,
    status: "TODO" as const,
    priority: "MEDIUM" as const,
    due_date: null,
    completed_at: null,
    position: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "2",
    user_id: "u1",
    project_id: null,
    parent_task_id: null,
    title: "Second",
    description: null,
    status: "TODO" as const,
    priority: "MEDIUM" as const,
    due_date: null,
    completed_at: null,
    position: 1,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

describe("TaskList", () => {
  it("renders a drag handle on each row when onReorder is provided", () => {
    render(
      <TaskList
        tasks={tasks}
        onOpenTask={vi.fn()}
        onToggleComplete={vi.fn()}
        onReorder={vi.fn()}
        emptyTitle="Empty"
        emptyDescription="Nothing here"
      />
    );
    expect(screen.getAllByLabelText(/drag to reorder/i)).toHaveLength(2);
  });

  it("renders no drag handles when onReorder is omitted (e.g. Completed view)", () => {
    render(
      <TaskList
        tasks={tasks}
        onOpenTask={vi.fn()}
        onToggleComplete={vi.fn()}
        emptyTitle="Empty"
        emptyDescription="Nothing here"
      />
    );
    expect(screen.queryByLabelText(/drag to reorder/i)).not.toBeInTheDocument();
  });

  it("still shows the empty state when there are no tasks", () => {
    render(
      <TaskList
        tasks={[]}
        onOpenTask={vi.fn()}
        onToggleComplete={vi.fn()}
        onReorder={vi.fn()}
        emptyTitle="No tasks"
        emptyDescription="Add one above"
      />
    );
    expect(screen.getByText("No tasks")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — no drag handle exists yet.

- [ ] **Step 4: Update `components/tasks/task-list.tsx`**

Replace the whole file:

```tsx
"use client";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, CheckCircle2 } from "lucide-react";
import { TaskRow } from "./task-row";
import { EmptyState } from "@/components/dashboard/empty-state";
import { calculateNewPosition } from "@/lib/tasks/reorder";
import type { Database } from "@/types/database";

type TaskRowData = Database["flowdo"]["Tables"]["tasks"]["Row"];

function SortableTaskRow({
  task,
  onOpen,
  onToggleComplete,
}: {
  task: TaskRowData;
  onOpen: (task: TaskRowData) => void;
  onToggleComplete: (task: TaskRowData) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab touch-none text-muted-foreground"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1">
        <TaskRow task={task} onOpen={onOpen} onToggleComplete={onToggleComplete} />
      </div>
    </div>
  );
}

export function TaskList({
  tasks,
  onOpenTask,
  onToggleComplete,
  onReorder,
  emptyTitle,
  emptyDescription,
}: {
  tasks: TaskRowData[];
  onOpenTask: (task: TaskRowData) => void;
  onToggleComplete: (task: TaskRowData) => void;
  onReorder?: (taskId: string, newPosition: number) => void;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  if (tasks.length === 0) {
    return <EmptyState icon={CheckCircle2} title={emptyTitle} description={emptyDescription} />;
  }

  if (!onReorder) {
    return (
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} onOpen={onOpenTask} onToggleComplete={onToggleComplete} />
        ))}
      </div>
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = tasks.findIndex((t) => t.id === active.id);
    const newIndex = tasks.findIndex((t) => t.id === over.id);
    const reordered = arrayMove(tasks, oldIndex, newIndex);

    const prevTask = reordered[newIndex - 1];
    const nextTask = reordered[newIndex + 1];
    const newPosition = calculateNewPosition(prevTask?.position ?? null, nextTask?.position ?? null);

    onReorder!(String(active.id), newPosition);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {tasks.map((task) => (
            <SortableTaskRow key={task.id} task={task} onOpen={onOpenTask} onToggleComplete={onToggleComplete} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json components/tasks/task-list.tsx components/tasks/task-list.test.tsx
git commit -m "FLOWDO-2: add drag-and-drop task reordering via dnd-kit"
```

---

### Task 10: Task filters bar

**Files:**
- Create: `lib/tasks/filter-params.ts`
- Create: `lib/tasks/filter-params.test.ts`
- Create: `components/tasks/task-filters.tsx`
- Create: `components/tasks/task-filters.test.tsx`

**Interfaces:**
- Produces: `parseFilterParams(searchParams: URLSearchParams | Record<string, string | string[] | undefined>): ListTasksFilters` (excluding `dueDate`/`excludeCompleted`/`projectId`, which each view sets itself — only the user-controlled subset: `status`, `priority`, `search`, `sort`), consumed by both the Server Component pages (Task 11) and `<TaskFilters>`.
- Produces: `<TaskFilters currentFilters, onChange: (filters) => void, projects, showProjectFilter?: boolean>`, consumed by Task 11.

- [ ] **Step 1: Write the failing test for the pure parser**

Create `lib/tasks/filter-params.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseFilterParams } from "./filter-params";

describe("parseFilterParams", () => {
  it("returns an empty object when nothing is set", () => {
    expect(parseFilterParams({})).toEqual({});
  });

  it("parses status, priority, search, and sort", () => {
    expect(
      parseFilterParams({ status: "TODO", priority: "HIGH", q: "milk", sort: "due_date" })
    ).toEqual({ status: "TODO", priority: "HIGH", search: "milk", sort: "due_date" });
  });

  it("ignores unrecognized values instead of throwing", () => {
    expect(parseFilterParams({ status: "NOT_A_STATUS", sort: "nonsense" })).toEqual({});
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — `lib/tasks/filter-params.ts` doesn't exist.

- [ ] **Step 3: Write `lib/tasks/filter-params.ts`**

```ts
import type { ListTasksFilters } from "./tasks";

const STATUSES = ["TODO", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const SORTS = ["due_date", "priority", "created_at", "alphabetical", "manual"] as const;

export type UserFilterParams = Pick<ListTasksFilters, "status" | "priority" | "search" | "sort">;

export function parseFilterParams(params: Record<string, string | string[] | undefined>): UserFilterParams {
  const result: UserFilterParams = {};

  const status = firstValue(params.status);
  if (status && (STATUSES as readonly string[]).includes(status)) {
    result.status = status as UserFilterParams["status"];
  }

  const priority = firstValue(params.priority);
  if (priority && (PRIORITIES as readonly string[]).includes(priority)) {
    result.priority = priority as UserFilterParams["priority"];
  }

  const search = firstValue(params.q);
  if (search) {
    result.search = search;
  }

  const sort = firstValue(params.sort);
  if (sort && (SORTS as readonly string[]).includes(sort)) {
    result.sort = sort as UserFilterParams["sort"];
  }

  return result;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Write the failing component test**

Create `components/tasks/task-filters.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskFilters } from "./task-filters";

describe("TaskFilters", () => {
  it("calls onChange with an updated search value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TaskFilters currentFilters={{}} onChange={onChange} projects={[]} />);

    await user.type(screen.getByPlaceholderText(/search/i), "milk");
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ search: "milk" }));
  });

  it("calls onChange with the selected priority", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TaskFilters currentFilters={{}} onChange={onChange} projects={[]} />);

    await user.selectOptions(screen.getByLabelText(/priority/i), "HIGH");
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ priority: "HIGH" }));
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — `components/tasks/task-filters.tsx` doesn't exist.

- [ ] **Step 7: Write `components/tasks/task-filters.tsx`**

```tsx
"use client";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { UserFilterParams } from "@/lib/tasks/filter-params";
import type { Database } from "@/types/database";

type ProjectRowData = Database["flowdo"]["Tables"]["projects"]["Row"];

export function TaskFilters({
  currentFilters,
  onChange,
  projects,
  showProjectFilter = false,
}: {
  currentFilters: UserFilterParams & { projectId?: string };
  onChange: (filters: UserFilterParams & { projectId?: string }) => void;
  projects: ProjectRowData[];
  showProjectFilter?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[160px]">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search tasks…"
          defaultValue={currentFilters.search ?? ""}
          onChange={(e) => onChange({ ...currentFilters, search: e.target.value || undefined })}
          className="pl-8"
        />
      </div>

      <select
        aria-label="Status"
        value={currentFilters.status ?? ""}
        onChange={(e) => onChange({ ...currentFilters, status: (e.target.value || undefined) as UserFilterParams["status"] })}
        className="h-10 rounded-md border border-border bg-background px-2 text-sm"
      >
        <option value="">Any status</option>
        <option value="TODO">To do</option>
        <option value="IN_PROGRESS">In progress</option>
        <option value="COMPLETED">Completed</option>
        <option value="CANCELLED">Cancelled</option>
      </select>

      <select
        aria-label="Priority"
        value={currentFilters.priority ?? ""}
        onChange={(e) => onChange({ ...currentFilters, priority: (e.target.value || undefined) as UserFilterParams["priority"] })}
        className="h-10 rounded-md border border-border bg-background px-2 text-sm"
      >
        <option value="">Any priority</option>
        <option value="LOW">Low</option>
        <option value="MEDIUM">Medium</option>
        <option value="HIGH">High</option>
        <option value="URGENT">Urgent</option>
      </select>

      {showProjectFilter && (
        <select
          aria-label="Project"
          value={currentFilters.projectId ?? ""}
          onChange={(e) => onChange({ ...currentFilters, projectId: e.target.value || undefined })}
          className="h-10 rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="">Any project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      )}

      <select
        aria-label="Sort"
        value={currentFilters.sort ?? "manual"}
        onChange={(e) => onChange({ ...currentFilters, sort: e.target.value as UserFilterParams["sort"] })}
        className="h-10 rounded-md border border-border bg-background px-2 text-sm"
      >
        <option value="manual">Manual order</option>
        <option value="due_date">Due date</option>
        <option value="priority">Priority</option>
        <option value="created_at">Created date</option>
        <option value="alphabetical">Alphabetical</option>
      </select>
    </div>
  );
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/tasks/filter-params.ts lib/tasks/filter-params.test.ts components/tasks/task-filters.tsx components/tasks/task-filters.test.tsx
git commit -m "FLOWDO-2: add URL-param-driven search/filter/sort bar"
```

---

### Task 11: Task view wiring + Inbox/Today/Upcoming/Completed pages

**Files:**
- Create: `components/tasks/task-view.tsx`
- Modify: `app/app/inbox/page.tsx`
- Create: `app/app/inbox/loading.tsx`
- Modify: `app/app/today/page.tsx`
- Create: `app/app/today/loading.tsx`
- Modify: `app/app/upcoming/page.tsx`
- Create: `app/app/upcoming/loading.tsx`
- Modify: `app/app/completed/page.tsx`
- Create: `app/app/completed/loading.tsx`

**Interfaces:**
- Consumes: `TaskList` (Task 9), `QuickAdd` (Task 7), `TaskDetailPanel` (Task 8), `TaskFilters`/`parseFilterParams` (Task 10), `listTasks`/`createTask`/`updateTask`/`deleteTask`/`completeTask`/`reopenTask`/`updateTaskPosition` (Task 3), `listProjects` (Task 5).
- Produces: `<TaskView initialTasks, projects, userId, baseFilters, viewKey, emptyState: { default: { title, description }, filtered: { title, description } }, enableReorder?, showProjectFilter?>`, a client component every task-list page renders. Shows `emptyState.filtered` copy when a search/status/priority/project filter is active and the result set is empty, `emptyState.default` copy otherwise, so an active filter never reads as a bug. Surfaces any mutation error as an inline banner (no raw Postgres/PostgREST error text).

- [ ] **Step 1: Write `components/tasks/task-view.tsx`**

```tsx
"use client";
import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { QuickAdd } from "./quick-add";
import { TaskFilters } from "./task-filters";
import { TaskList } from "./task-list";
import { TaskDetailPanel } from "./task-detail-panel";
import { createClient } from "@/lib/supabase/client";
import {
  createTask,
  updateTask,
  deleteTask,
  completeTask,
  reopenTask,
  updateTaskPosition,
  listTasks,
  type ListTasksFilters,
} from "@/lib/tasks/tasks";
import { parseFilterParams, type UserFilterParams } from "@/lib/tasks/filter-params";
import type { TaskInput } from "@/lib/validations/tasks";
import type { Database } from "@/types/database";

type TaskRowData = Database["flowdo"]["Tables"]["tasks"]["Row"];
type ProjectRowData = Database["flowdo"]["Tables"]["projects"]["Row"];

export interface EmptyStateCopy {
  title: string;
  description: string;
}

export function TaskView({
  initialTasks,
  projects,
  userId,
  baseFilters,
  viewKey,
  emptyState,
  enableReorder = false,
  showProjectFilter = false,
}: {
  initialTasks: TaskRowData[];
  projects: ProjectRowData[];
  userId: string;
  baseFilters: Omit<ListTasksFilters, "status" | "priority" | "search" | "sort">;
  viewKey: string;
  emptyState: { default: EmptyStateCopy; filtered: EmptyStateCopy };
  enableReorder?: boolean;
  showProjectFilter?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const supabase = createClient();
  const [openTask, setOpenTask] = React.useState<TaskRowData | null>(null);
  const [mutationError, setMutationError] = React.useState<string | null>(null);

  const userFilters: UserFilterParams & { projectId?: string } = {
    ...parseFilterParams(Object.fromEntries(searchParams.entries())),
    projectId: searchParams.get("project") ?? undefined,
  };
  const hasActiveFilter = Boolean(
    userFilters.status || userFilters.priority || userFilters.search || userFilters.projectId
  );

  const fullFilters: ListTasksFilters = { ...baseFilters, ...userFilters };
  const queryKey = ["tasks", viewKey, fullFilters];

  const { data: tasks } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await listTasks(supabase, fullFilters);
      if (error) setMutationError(error);
      return data ?? [];
    },
    initialData: JSON.stringify(fullFilters) === JSON.stringify(baseFilters) ? initialTasks : undefined,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["tasks", viewKey] });
  }

  function reportError(result: { error: string | null }) {
    setMutationError(result.error);
    if (!result.error) invalidate();
  }

  const createMutation = useMutation({
    mutationFn: (title: string) => createTask(supabase, userId, { title, ...taskDefaultsFor(baseFilters) }),
    onSuccess: reportError,
  });

  const toggleCompleteMutation = useMutation({
    mutationFn: (task: TaskRowData) =>
      task.status === "COMPLETED" ? reopenTask(supabase, task.id) : completeTask(supabase, task.id),
    onSuccess: reportError,
  });

  const saveMutation = useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: TaskInput }) => updateTask(supabase, taskId, input),
    onSuccess: reportError,
  });

  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => deleteTask(supabase, taskId),
    onSuccess: reportError,
  });

  const reorderMutation = useMutation({
    mutationFn: ({ taskId, position }: { taskId: string; position: number }) =>
      updateTaskPosition(supabase, taskId, position),
    onSuccess: reportError,
  });

  function updateUrlFilters(next: UserFilterParams & { projectId?: string }) {
    const params = new URLSearchParams();
    if (next.status) params.set("status", next.status);
    if (next.priority) params.set("priority", next.priority);
    if (next.search) params.set("q", next.search);
    if (next.sort) params.set("sort", next.sort);
    if (next.projectId) params.set("project", next.projectId);
    router.push(`?${params.toString()}`, { scroll: false });
  }

  const activeEmptyState = hasActiveFilter ? emptyState.filtered : emptyState.default;

  return (
    <div className="space-y-4">
      {mutationError && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {mutationError}
        </div>
      )}
      <QuickAdd onCreate={(title) => createMutation.mutateAsync(title)} />
      <TaskFilters
        currentFilters={userFilters}
        onChange={updateUrlFilters}
        projects={projects}
        showProjectFilter={showProjectFilter}
      />
      <TaskList
        tasks={tasks ?? []}
        onOpenTask={setOpenTask}
        onToggleComplete={(task) => toggleCompleteMutation.mutate(task)}
        onReorder={
          enableReorder ? (taskId, position) => reorderMutation.mutate({ taskId, position }) : undefined
        }
        emptyTitle={activeEmptyState.title}
        emptyDescription={activeEmptyState.description}
      />
      {openTask && (
        <TaskDetailPanel
          task={openTask}
          projects={projects}
          open={!!openTask}
          onOpenChange={(open) => !open && setOpenTask(null)}
          onSave={(taskId, input) => saveMutation.mutateAsync({ taskId, input })}
          onDelete={(taskId) => {
            deleteMutation.mutate(taskId);
            setOpenTask(null);
          }}
        />
      )}
    </div>
  );
}

function taskDefaultsFor(baseFilters: Omit<ListTasksFilters, "status" | "priority" | "search" | "sort">) {
  const defaults: { projectId?: string; dueDate?: string } = {};
  if (baseFilters.projectId) defaults.projectId = baseFilters.projectId;
  if (baseFilters.dueDate === "today") defaults.dueDate = new Date().toISOString();
  return defaults;
}
```

Note: `createMutation`/`toggleCompleteMutation`/etc. call `reportError`, which expects `{ error: string | null }` — `createTask`/`updateTask` actually resolve to `{ data, error }`, which is a superset and satisfies that shape structurally, so no adapter is needed.

- [ ] **Step 2: Write `app/app/inbox/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import { listTasks } from "@/lib/tasks/tasks";
import { listProjects } from "@/lib/projects/projects";
import { TaskView } from "@/components/tasks/task-view";

export default async function InboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const baseFilters = { projectId: null, excludeCompleted: true } as const;
  const [{ data: tasks }, { data: projects }] = await Promise.all([
    listTasks(supabase, baseFilters),
    listProjects(supabase),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Inbox</h1>
      <TaskView
        initialTasks={tasks ?? []}
        projects={projects ?? []}
        userId={user!.id}
        baseFilters={baseFilters}
        viewKey="inbox"
        emptyState={{
          default: { title: "Inbox is empty", description: "Unassigned tasks will land here." },
          filtered: { title: "No tasks match your filters", description: "Try clearing a filter or search term." },
        }}
        enableReorder
      />
    </div>
  );
}
```

- [ ] **Step 3: Write `app/app/inbox/loading.tsx`**

```tsx
export default function InboxLoading() {
  return (
    <div className="space-y-6">
      <div className="h-6 w-24 animate-pulse rounded bg-muted" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-11 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write `app/app/today/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import { listTasks } from "@/lib/tasks/tasks";
import { listProjects } from "@/lib/projects/projects";
import { TaskView } from "@/components/tasks/task-view";

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const baseFilters = { dueDate: "today", excludeCompleted: true } as const;
  const [{ data: tasks }, { data: projects }] = await Promise.all([
    listTasks(supabase, baseFilters),
    listProjects(supabase),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Today</h1>
      <TaskView
        initialTasks={tasks ?? []}
        projects={projects ?? []}
        userId={user!.id}
        baseFilters={baseFilters}
        viewKey="today"
        emptyState={{
          default: { title: "Nothing due today", description: "Tasks due today will show up here." },
          filtered: { title: "No tasks match your filters", description: "Try clearing a filter or search term." },
        }}
        enableReorder
        showProjectFilter
      />
    </div>
  );
}
```

- [ ] **Step 5: Write `app/app/today/loading.tsx`**

```tsx
export default function TodayLoading() {
  return (
    <div className="space-y-6">
      <div className="h-6 w-24 animate-pulse rounded bg-muted" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-11 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Write `app/app/upcoming/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import { listTasks } from "@/lib/tasks/tasks";
import { listProjects } from "@/lib/projects/projects";
import { TaskView } from "@/components/tasks/task-view";

export default async function UpcomingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const baseFilters = { dueDate: "upcoming", excludeCompleted: true } as const;
  const [{ data: tasks }, { data: projects }] = await Promise.all([
    listTasks(supabase, baseFilters),
    listProjects(supabase),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Upcoming</h1>
      <TaskView
        initialTasks={tasks ?? []}
        projects={projects ?? []}
        userId={user!.id}
        baseFilters={baseFilters}
        viewKey="upcoming"
        emptyState={{
          default: { title: "No upcoming tasks", description: "Tasks due soon will show up here." },
          filtered: { title: "No tasks match your filters", description: "Try clearing a filter or search term." },
        }}
        enableReorder
        showProjectFilter
      />
    </div>
  );
}
```

- [ ] **Step 7: Write `app/app/upcoming/loading.tsx`**

```tsx
export default function UpcomingLoading() {
  return (
    <div className="space-y-6">
      <div className="h-6 w-24 animate-pulse rounded bg-muted" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-11 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Write `app/app/completed/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import { listTasks } from "@/lib/tasks/tasks";
import { listProjects } from "@/lib/projects/projects";
import { TaskView } from "@/components/tasks/task-view";

export default async function CompletedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const baseFilters = { status: "COMPLETED" } as const;
  const [{ data: tasks }, { data: projects }] = await Promise.all([
    listTasks(supabase, baseFilters),
    listProjects(supabase),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Completed</h1>
      <TaskView
        initialTasks={tasks ?? []}
        projects={projects ?? []}
        userId={user!.id}
        baseFilters={baseFilters}
        viewKey="completed"
        emptyState={{
          default: { title: "No completed tasks yet", description: "Tasks you finish will show up here." },
          filtered: { title: "No completed tasks match your filters", description: "Try clearing a filter or search term." },
        }}
        showProjectFilter
      />
    </div>
  );
}
```

- [ ] **Step 9: Write `app/app/completed/loading.tsx`**

```tsx
export default function CompletedLoading() {
  return (
    <div className="space-y-6">
      <div className="h-6 w-24 animate-pulse rounded bg-muted" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-11 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Verify build**

Run: `npm run build`
Expected: succeeds — all four pages compile and render.

- [ ] **Step 11: Manual smoke check**

With `npx supabase start` and `npm run dev` running: log in, visit `/app/inbox`, add a task via quick-add, confirm it appears; click it, edit its due date to today, save; visit `/app/today`, confirm it now appears there; check its complete checkbox; visit `/app/completed`, confirm it's there.

- [ ] **Step 12: Commit**

```bash
git add components/tasks/task-view.tsx app/app/inbox app/app/today app/app/upcoming app/app/completed
git commit -m "FLOWDO-2: wire task CRUD, filters, and drag-and-drop into Inbox/Today/Upcoming/Completed views"
```

---

### Task 12: Project pages

**Files:**
- Create: `components/projects/project-card.tsx`
- Create: `components/projects/project-form-dialog.tsx`
- Create: `components/projects/project-stats-header.tsx`
- Modify: `app/app/projects/page.tsx`
- Create: `app/app/projects/new-project-button.tsx`
- Create: `app/app/projects/loading.tsx`
- Create: `app/app/projects/[id]/page.tsx`
- Create: `app/app/projects/[id]/archive-project-button.tsx`
- Create: `app/app/projects/[id]/loading.tsx`

**Interfaces:**
- Consumes: `createProject`/`updateProject`/`archiveProject`/`listProjects`/`getProject` (Task 5), `PROJECT_COLORS`/`PROJECT_ICONS`/`getProjectIcon` (Task 5), `projectSchema`/`ProjectInput` (Task 2), `TaskView` (Task 11).

- [ ] **Step 1: Write `components/projects/project-card.tsx`**

```tsx
import Link from "next/link";
import { getProjectIcon } from "@/lib/constants/project-icons";
import type { Database } from "@/types/database";

type ProjectRowData = Database["flowdo"]["Tables"]["projects"]["Row"];

export function ProjectCard({ project, taskCount }: { project: ProjectRowData; taskCount: number }) {
  const Icon = getProjectIcon(project.icon);

  return (
    <Link
      href={`/app/projects/${project.id}`}
      className="flex flex-col gap-3 rounded-lg border border-border p-4 hover:bg-muted"
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-md"
        style={{ backgroundColor: `${project.color}1A`, color: project.color }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="font-medium">{project.name}</p>
        <p className="text-sm text-muted-foreground">
          {taskCount} {taskCount === 1 ? "task" : "tasks"}
        </p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Write `components/projects/project-form-dialog.tsx`**

```tsx
"use client";
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { projectSchema, type ProjectInput } from "@/lib/validations/tasks";
import { PROJECT_COLORS } from "@/lib/constants/project-colors";
import { PROJECT_ICONS } from "@/lib/constants/project-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form-error";
import { cn } from "@/lib/utils";

export function ProjectFormDialog({
  trigger,
  onCreate,
}: {
  trigger: React.ReactNode;
  onCreate: (input: ProjectInput) => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProjectInput>({
    resolver: zodResolver(projectSchema),
    defaultValues: { color: PROJECT_COLORS[0].value, icon: PROJECT_ICONS[0].name },
  });

  const selectedColor = watch("color");
  const selectedIcon = watch("icon");

  async function onSubmit(values: ProjectInput) {
    await onCreate(values);
    reset();
    setOpen(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-lg bg-background p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">New project</Dialog.Title>
            <Dialog.Close asChild>
              <button aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...register("name")} />
              <FormError message={errors.name?.message} />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {PROJECT_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    aria-label={color.name}
                    onClick={() => setValue("color", color.value)}
                    className={cn(
                      "h-7 w-7 rounded-full border-2",
                      selectedColor === color.value ? "border-foreground" : "border-transparent"
                    )}
                    style={{ backgroundColor: color.value }}
                  />
                ))}
              </div>
              <FormError message={errors.color?.message} />
            </div>

            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-2">
                {PROJECT_ICONS.map(({ name, icon: Icon }) => (
                  <button
                    key={name}
                    type="button"
                    aria-label={name}
                    onClick={() => setValue("icon", name)}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-md border",
                      selectedIcon === name ? "border-primary bg-primary/10" : "border-border"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
              <FormError message={errors.icon?.message} />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create project"}
            </Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 3: Write `components/projects/project-stats-header.tsx`**

```tsx
import * as React from "react";
import { getProjectIcon } from "@/lib/constants/project-icons";
import type { Database } from "@/types/database";

type ProjectRowData = Database["flowdo"]["Tables"]["projects"]["Row"];

export function ProjectStatsHeader({
  project,
  total,
  completed,
  overdue,
  actions,
}: {
  project: ProjectRowData;
  total: number;
  completed: number;
  overdue: number;
  actions?: React.ReactNode;
}) {
  const Icon = getProjectIcon(project.icon);
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-center gap-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-md"
          style={{ backgroundColor: `${project.color}1A`, color: project.color }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <h1 className="text-xl font-semibold">{project.name}</h1>
        {project.status === "ARCHIVED" && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Archived
          </span>
        )}
        {actions && <div className="ml-auto">{actions}</div>}
      </div>
      <div className="flex gap-6 text-sm text-muted-foreground">
        <span>{total} total</span>
        <span>{completed} completed</span>
        {overdue > 0 && <span className="text-destructive">{overdue} overdue</span>}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write `app/app/projects/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import { listProjects, createProject } from "@/lib/projects/projects";
import { listTasks } from "@/lib/tasks/tasks";
import { ProjectCard } from "@/components/projects/project-card";
import { NewProjectButton } from "./new-project-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { FolderKanban } from "lucide-react";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: projects } = await listProjects(supabase);

  const projectsWithCounts = await Promise.all(
    (projects ?? []).map(async (project) => {
      const { data: tasks } = await listTasks(supabase, { projectId: project.id, excludeCompleted: true });
      return { project, taskCount: tasks?.length ?? 0 };
    })
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Projects</h1>
        <NewProjectButton />
      </div>
      {projectsWithCounts.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create a project to organize your tasks."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projectsWithCounts.map(({ project, taskCount }) => (
            <ProjectCard key={project.id} project={project} taskCount={taskCount} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Write `app/app/projects/loading.tsx`**

```tsx
export default function ProjectsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-6 w-24 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Write `app/app/projects/new-project-button.tsx`** (small client wrapper so the Server Component page stays a Server Component)

```tsx
"use client";
import { useRouter } from "next/navigation";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { createProject } from "@/lib/projects/projects";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { ProjectInput } from "@/lib/validations/tasks";

export function NewProjectButton() {
  const router = useRouter();
  const supabase = createClient();

  async function handleCreate(input: ProjectInput) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await createProject(supabase, user.id, input);
    router.refresh();
  }

  return (
    <ProjectFormDialog
      trigger={
        <Button>
          <Plus className="mr-2 h-4 w-4" /> New project
        </Button>
      }
      onCreate={handleCreate}
    />
  );
}
```

- [ ] **Step 7: Write `app/app/projects/[id]/archive-project-button.tsx`**

```tsx
"use client";
import { useRouter } from "next/navigation";
import { archiveProject } from "@/lib/projects/projects";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function ArchiveProjectButton({ projectId, isArchived }: { projectId: string; isArchived: boolean }) {
  const router = useRouter();
  const supabase = createClient();

  if (isArchived) return null;

  async function handleArchive() {
    await archiveProject(supabase, projectId);
    router.refresh();
  }

  return (
    <Button type="button" variant="ghost" onClick={handleArchive}>
      Archive
    </Button>
  );
}
```

- [ ] **Step 8: Write `app/app/projects/[id]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProject, listProjects } from "@/lib/projects/projects";
import { listTasks } from "@/lib/tasks/tasks";
import { ProjectStatsHeader } from "@/components/projects/project-stats-header";
import { TaskView } from "@/components/tasks/task-view";
import { ArchiveProjectButton } from "./archive-project-button";

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: project } = await getProject(supabase, params.id);
  if (!project) notFound();

  const baseFilters = { projectId: project.id, excludeCompleted: true } as const;
  const [{ data: tasks }, { data: allTasksInProject }, { data: projects }] = await Promise.all([
    listTasks(supabase, baseFilters),
    listTasks(supabase, { projectId: project.id }),
    listProjects(supabase),
  ]);

  const total = allTasksInProject?.length ?? 0;
  const completed = allTasksInProject?.filter((t) => t.status === "COMPLETED").length ?? 0;
  const overdue =
    allTasksInProject?.filter(
      (t) => t.status !== "COMPLETED" && t.due_date && new Date(t.due_date) < new Date()
    ).length ?? 0;

  return (
    <div className="space-y-6">
      <ProjectStatsHeader
        project={project}
        total={total}
        completed={completed}
        overdue={overdue}
        actions={<ArchiveProjectButton projectId={project.id} isArchived={project.status === "ARCHIVED"} />}
      />
      <TaskView
        initialTasks={tasks ?? []}
        projects={projects ?? []}
        userId={user!.id}
        baseFilters={baseFilters}
        viewKey={`project-${project.id}`}
        emptyState={{
          default: { title: "No tasks in this project yet", description: "Add one above." },
          filtered: { title: "No tasks match your filters", description: "Try clearing a filter or search term." },
        }}
        enableReorder
      />
    </div>
  );
}
```

- [ ] **Step 9: Write `app/app/projects/[id]/loading.tsx`**

```tsx
export default function ProjectDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="h-24 animate-pulse rounded-lg bg-muted" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-11 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 11: Manual smoke check**

Create a project, confirm it appears on `/app/projects` with a 0-task count, add a task from its overview page, confirm the count/progress bar update, click "Archive", confirm it disappears from `/app/projects` but its overview page still loads (with the "Archived" badge and no Archive button).

- [ ] **Step 12: Commit**

```bash
git add components/projects app/app/projects
git commit -m "FLOWDO-2: add project list, creation dialog, overview page, and archiving"
```

---

### Task 13: Dashboard widgets

**Files:**
- Create: `lib/tasks/dashboard-stats.ts`
- Create: `lib/tasks/dashboard-stats.test.ts`
- Modify: `app/app/dashboard/page.tsx`

**Interfaces:**
- Produces: `computeDashboardStats(tasks: TaskRow[], now?: Date): { todayTotal: number; todayCompleted: number; overdueCount: number }`, a pure function consumed by the dashboard page.

- [ ] **Step 1: Write the failing unit test**

Create `lib/tasks/dashboard-stats.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeDashboardStats } from "./dashboard-stats";

const now = new Date("2026-03-15T12:00:00.000Z");

function task(overrides: Partial<{ status: string; due_date: string | null }>) {
  return {
    id: "1",
    user_id: "u1",
    project_id: null,
    parent_task_id: null,
    title: "x",
    description: null,
    status: "TODO",
    priority: "MEDIUM",
    due_date: null,
    completed_at: null,
    position: 0,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    ...overrides,
  } as never;
}

describe("computeDashboardStats", () => {
  it("counts today's total and completed tasks", () => {
    const tasks = [
      task({ due_date: "2026-03-15T09:00:00.000Z", status: "TODO" }),
      task({ due_date: "2026-03-15T18:00:00.000Z", status: "COMPLETED" }),
      task({ due_date: "2026-03-16T09:00:00.000Z", status: "TODO" }),
    ];
    const stats = computeDashboardStats(tasks, now);
    expect(stats.todayTotal).toBe(2);
    expect(stats.todayCompleted).toBe(1);
  });

  it("counts overdue tasks (past due, not completed)", () => {
    const tasks = [
      task({ due_date: "2026-03-10T09:00:00.000Z", status: "TODO" }),
      task({ due_date: "2026-03-10T09:00:00.000Z", status: "COMPLETED" }),
      task({ due_date: "2026-03-20T09:00:00.000Z", status: "TODO" }),
    ];
    expect(computeDashboardStats(tasks, now).overdueCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — `lib/tasks/dashboard-stats.ts` doesn't exist.

- [ ] **Step 3: Write `lib/tasks/dashboard-stats.ts`**

```ts
import { getTodayRange } from "./date-ranges";
import type { Database } from "@/types/database";

type TaskRow = Database["flowdo"]["Tables"]["tasks"]["Row"];

export function computeDashboardStats(tasks: TaskRow[], now: Date = new Date()) {
  const { start, end } = getTodayRange(now);

  const todayTasks = tasks.filter((t) => t.due_date && t.due_date >= start && t.due_date < end);
  const todayCompleted = todayTasks.filter((t) => t.status === "COMPLETED").length;

  const overdueCount = tasks.filter(
    (t) => t.status !== "COMPLETED" && t.due_date && t.due_date < start
  ).length;

  return { todayTotal: todayTasks.length, todayCompleted, overdueCount };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Write `app/app/dashboard/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import { listTasks } from "@/lib/tasks/tasks";
import { listProjects } from "@/lib/projects/projects";
import { computeDashboardStats } from "@/lib/tasks/dashboard-stats";
import { TaskList } from "@/components/tasks/task-list";
import { ProjectCard } from "@/components/projects/project-card";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: allTasks }, { data: projects }] = await Promise.all([
    listTasks(supabase, {}),
    listProjects(supabase),
  ]);

  const stats = computeDashboardStats(allTasks ?? []);
  const todayTasks = (allTasks ?? []).filter((t) => {
    if (!t.due_date) return false;
    const today = new Date().toDateString();
    return new Date(t.due_date).toDateString() === today;
  });

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Hey, {firstName}</h1>
        <p className="text-sm text-muted-foreground">
          {stats.todayCompleted} of {stats.todayTotal} tasks done today
        </p>
      </div>

      {stats.overdueCount > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {stats.overdueCount} overdue {stats.overdueCount === 1 ? "task" : "tasks"}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Today</h2>
        <TaskList
          tasks={todayTasks}
          onOpenTask={() => {}}
          onToggleComplete={() => {}}
          emptyTitle="Nothing due today"
          emptyDescription="Enjoy the calm."
        />
      </div>

      {(projects ?? []).length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Projects</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(projects ?? []).slice(0, 3).map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                taskCount={(allTasks ?? []).filter((t) => t.project_id === project.id && t.status !== "COMPLETED").length}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

Note: the dashboard's `<TaskList>` here is read-only for interactions (`onOpenTask`/`onToggleComplete` are no-ops) — clicking through to `/app/today` is where real interaction happens. This is a deliberate simplification; if you want the dashboard's today list to be fully interactive, wrap it in a small client component using the same mutation pattern as `TaskView`, but that's beyond this task's scope per the spec ("don't overload the dashboard").

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 7: Commit**

```bash
git add lib/tasks/dashboard-stats.ts lib/tasks/dashboard-stats.test.ts app/app/dashboard/page.tsx
git commit -m "FLOWDO-2: add real dashboard widgets (today's progress, overdue callout, project summary)"
```

---

### Task 14: Final verification + README update

**Files:**
- Modify: `README.md`

**Interfaces:**
- None — this task consumes everything built in Tasks 1-13 and verifies/documents it as a whole.

- [ ] **Step 1: Run the full verification suite**

Run: `npm run lint && npm run typecheck && npm test && npm run test:integration && npm run build`
Expected: all five succeed with zero errors. If any fail, use `superpowers:systematic-debugging` to find root cause — do not patch symptoms.

- [ ] **Step 2: Manual smoke test**

With `npx supabase start` and `npm run dev` running, in a browser:
1. Quick-add a task from Inbox; confirm it appears with no project, no due date.
2. Open it, set a due date to today, priority High, save; confirm it now appears on `/app/today` with a "High" badge and no longer on `/app/inbox`.
3. Create a project; assign the task to it via the detail panel. Today's filter is `due_date = today`, independent of project, so confirm the task still shows on `/app/today` AND on the project's overview page simultaneously.
4. Check the task complete on any view; confirm it appears on `/app/completed` and vanishes from the view it was completed from.
5. Reopen it from Completed; confirm it returns to its prior view.
6. Search for a task by a partial word in its title.
7. Filter by priority; filter by status; sort by due date; sort alphabetically.
8. Drag-reorder two tasks in Inbox; refresh the page; confirm the new order persisted.
9. Click "Archive" on the project's overview page; confirm it disappears from `/app/projects` while its task keeps its `project_id` and the (now-archived) project's own overview page still loads directly, showing the "Archived" badge and no Archive button.
10. Confirm the Dashboard shows the correct "today" count, an overdue callout only when you actually have an overdue task, and a project summary card.

Record the outcome of each step; do not report Phase 2 complete if any step fails.

- [ ] **Step 3: Update `README.md`**

Read the current file first. Add a new section after "## Roadmap" (or wherever the Phase list is) noting Phase 2 is complete, and add a "## Task & project management" section documenting: the `lib/tasks/*.ts` / `lib/projects/*.ts` data-layer pattern (no Server Actions, same as auth), that filters live in the URL, and that drag-and-drop position uses a midpoint-calculation scheme (`lib/tasks/reorder.ts`) rather than rewriting every row on each reorder.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "FLOWDO-2: update README for Phase 2 (task/project management)"
```

- [ ] **Step 5: Request code review**

Invoke `superpowers:requesting-code-review` against the full diff since Task 1. Address all valid findings, then re-run Step 1's full verification suite before considering Phase 2 done.
