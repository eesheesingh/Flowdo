# FlowDo Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add subtasks, labels, a calendar view, recurring tasks, an automatic activity log, and derived in-app notifications on top of Phase 2's task/project CRUD.

**Architecture:** Keep every Phase 1/2 pattern — small typed functions in `lib/*` that take a Supabase client and do one operation; Server Components for first paint, TanStack Query for interaction; no Next.js Server Actions; authorization is RLS via `auth.uid()`; URL search params hold shareable view state. New cross-cutting DB behavior (activity logging) is done with `SECURITY DEFINER` triggers, matching `set_updated_at` / `handle_new_user`. Notifications are *derived* from tasks + current time on each load — no cron, no worker; the `notifications` table stores only dismissals.

**Tech Stack:** Next.js 14 App Router, TypeScript (strict), Supabase (`@supabase/ssr`, `flowdo` schema, RLS), TanStack Query v5, React Hook Form + Zod, Radix (Dialog/Dropdown), Lucide, Vitest + RTL. **No new npm dependencies.**

**Spec:** `docs/superpowers/specs/2026-09-07-flowdo-phase3-design.md` — read it alongside this plan.

## Global Constraints

- **No new npm dependencies.** Everything needed is already in `package.json`.
- **No Next.js Server Actions.** Mutations are plain functions in `lib/*` called from TanStack Query mutations (browser client) or Server Components (server client), exactly like `lib/tasks/tasks.ts`.
- **No calendar library.** The calendar is built from date math in `lib/calendar/month.ts`.
- **No `pg_cron` / cron route / worker.** Notifications are derived; only dismissal rows are written.
- **All authorization is RLS.** Never filter by a client-supplied `user_id`; never add an `activity_logs` INSERT policy (the trigger is `SECURITY DEFINER`).
- **UTC date math**, consistent with `lib/tasks/date-ranges.ts` — never `toLocaleDateString` in rendered output (hydration mismatch risk; see `components/tasks/task-row.tsx`).
- **`types/database.ts` is hand-maintained** (not `supabase gen types`). Every migration has a matching hand-edit to it.
- **Error strings are human-readable**, never raw Postgres/PostgREST errors — `return { data: null, error: "Couldn't …" }`, matching every existing `lib/` function.
- **Colours** come from `lib/constants/project-colors.ts` (`PROJECT_COLORS`) — no free-form colour picker.
- **Subtasks never appear** in Inbox/Today/Upcoming/Completed/calendar lists or dashboard counts (`parent_task_id IS NULL` on every base filter).
- **Recurring tasks require a due date.** No due date → recurrence disabled in the form, no occurrence generated.
- **Verification per task:** `npm run lint && npm run typecheck && npm test` must pass before every commit. **Per wave checkpoint:** additionally `npm run test:integration` (needs `npx supabase start`) and `npm run build`.
- **Commit message convention:** subject prefixed with the Kaido work-item key(s), e.g. `FLOWDO-4.1: add subtask data layer`. Footer:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3
  ```
- **Branch:** all work on `flowdo-4-phase3` (create via `superpowers:using-git-worktrees`). One PR to `main` after Wave C.

---

## File Structure

### Created

| File | Responsibility |
|---|---|
| `lib/tasks/subtasks.ts` | `listSubtasks`, `createSubtask`, pure `subtaskProgress` |
| `lib/tasks/subtasks.test.ts` | unit test for `subtaskProgress` |
| `lib/tasks/recurrence.ts` | pure `nextDueDate` |
| `lib/tasks/recurrence.test.ts` | unit tests for `nextDueDate` |
| `lib/labels/labels.ts` | label CRUD (`listLabels`/`createLabel`/`updateLabel`/`deleteLabel`) |
| `lib/tasks/task-labels.ts` | `listTaskLabels`, `setTaskLabels` (diff-based) |
| `lib/calendar/month.ts` | pure `buildMonthGrid`, `monthRange` |
| `lib/calendar/month.test.ts` | unit tests |
| `lib/activity/activity.ts` | `listActivity` |
| `lib/activity/format.ts` | pure `describeActivity` |
| `lib/activity/format.test.ts` | unit tests |
| `lib/notifications/derive.ts` | pure `deriveNotifications` |
| `lib/notifications/derive.test.ts` | unit tests |
| `lib/notifications/notifications.ts` | `listReadKeys`, `markRead`, `markAllRead` |
| `components/tasks/subtask-section.tsx` | subtask list + inline add + progress bar (in detail panel) |
| `components/tasks/subtask-section.test.tsx` | component test |
| `components/tasks/label-picker.tsx` | chip multi-select + "＋ New label" (in detail panel) |
| `components/tasks/label-picker.test.tsx` | component test |
| `components/tasks/recurrence-field.tsx` | recurrence `<select>` + Custom interval inputs |
| `components/tasks/recurrence-field.test.tsx` | component test |
| `components/tasks/activity-feed.tsx` | read-only reverse-chron activity list |
| `components/labels/manage-labels-dialog.tsx` | label CRUD dialog, reused by picker + filters |
| `components/labels/manage-labels-dialog.test.tsx` | component test |
| `components/calendar/month-grid.tsx` | month grid, day cells, prev/next nav |
| `components/calendar/month-grid.test.tsx` | component test |
| `components/calendar/create-task-dialog.tsx` | "create a task on this day" dialog |
| `components/notifications/notification-bell.tsx` | topbar bell, badge, dropdown |
| `components/notifications/notification-bell.test.tsx` | component test |
| `supabase/migrations/0007_task_recurrence.sql` | recurrence enum + columns |
| `supabase/migrations/0008_activity_log_triggers.sql` | activity trigger functions + triggers |
| `supabase/migrations/0009_notification_dismissals.sql` | `dedupe_key` column + INSERT policy |
| `tests/integration/subtasks.test.ts` | subtask RLS + flat-view exclusion |
| `tests/integration/labels.test.ts` | label CRUD + `task_labels` + label filter + RLS |
| `tests/integration/recurrence.test.ts` | `completeTask` occurrence generation |
| `tests/integration/calendar.test.ts` | `dueDateRange` filter |
| `tests/integration/activity.test.ts` | trigger rows for every action, delete-null-FK |
| `tests/integration/notifications.test.ts` | dismissal upsert, idempotency, RLS |
| `tests/integration/phase3-migrations.test.ts` | columns/enums/policies exist |

### Modified

| File | Change |
|---|---|
| `lib/tasks/tasks.ts` | `listTasks` gains `parentTaskId`, `labelId`, `dueDateRange`, `hasDueDate`; `completeTask` returns the row and generates the next recurrence occurrence |
| `lib/tasks/filter-params.ts` | parse `label` URL param → `labelId` |
| `lib/tasks/dashboard-stats.ts` | exclude subtasks before counting |
| `lib/tasks/dashboard-stats.test.ts` | add subtask-exclusion case |
| `lib/validations/tasks.ts` | `taskSchema` gains `recurrence` + `recurrenceRule`; add `labelSchema` |
| `lib/validations/tasks.test.ts` | recurrence + label schema cases |
| `types/database.ts` | add `labels`, `task_labels`, `notifications`, `activity_logs` table types; `tasks` gains `recurrence`, `recurrence_rule`; `notifications` gains `dedupe_key` |
| `components/tasks/task-detail-panel.tsx` | mount `SubtaskSection`, `LabelPicker`, `RecurrenceField`, `ActivityFeed`; split those blocks out |
| `components/tasks/task-view.tsx` | pass `labels` down; add subtask/label/recurrence mutations; pass through to panel |
| `components/tasks/task-row.tsx` | render label chips + a repeat icon when recurring |
| `components/tasks/task-filters.tsx` | label `<select>` + "Manage labels" trigger |
| `components/tasks/task-list.tsx` | (no logic change; `TaskRow` prop additions are optional/back-compatible) |
| `app/app/inbox/page.tsx`, `today/page.tsx`, `upcoming/page.tsx`, `completed/page.tsx` | add `parentTaskId: null` to `baseFilters` |
| `app/app/projects/[id]/page.tsx` | `parentTaskId: null` in base filters; add `<ActivityFeed projectId=…>` section |
| `app/app/dashboard/page.tsx` | (no change — `computeDashboardStats` handles exclusion internally) |
| `app/app/calendar/page.tsx` | replace stub with the real Server Component |
| `app/app/layout.tsx` | fetch bell data, render `<NotificationBell>` in the header |

---

## Interfaces locked by this plan

Copy these signatures verbatim where a task says "Consumes":

```ts
// lib/tasks/subtasks.ts
type Client = SupabaseClient<Database, "flowdo">;
export function subtaskProgress(rows: { status: string }[]): { done: number; total: number };
export function listSubtasks(supabase: Client, parentId: string):
  Promise<{ data: TaskRow[] | null; error: string | null }>;
export function createSubtask(supabase: Client, userId: string, parentId: string, title: string):
  Promise<{ data: TaskRow | null; error: string | null }>;

// lib/tasks/tasks.ts — ListTasksFilters gains:
//   parentTaskId?: string | null
//   labelId?: string
//   dueDateRange?: { start: string; end: string }   // [start, end) on due_date
//   hasDueDate?: boolean                              // true => due_date IS NOT NULL

// lib/tasks/recurrence.ts
export type Recurrence = "NEVER" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | "CUSTOM";
export type RecurrenceRule = { interval: number; unit: "day" | "week" | "month" | "year" };
export function nextDueDate(current: Date, recurrence: Exclude<Recurrence, "NEVER">, rule: RecurrenceRule | null): Date;

// lib/labels/labels.ts
type LabelRow = Database["flowdo"]["Tables"]["labels"]["Row"];
export function listLabels(supabase: Client): Promise<{ data: LabelRow[] | null; error: string | null }>;
export function createLabel(supabase: Client, userId: string, input: { name: string; color: string }):
  Promise<{ data: LabelRow | null; error: string | null }>;
export function updateLabel(supabase: Client, labelId: string, input: { name?: string; color?: string }):
  Promise<{ data: LabelRow | null; error: string | null }>;
export function deleteLabel(supabase: Client, labelId: string): Promise<{ error: string | null }>;

// lib/tasks/task-labels.ts
export function listTaskLabels(supabase: Client, taskId: string):
  Promise<{ data: string[] | null; error: string | null }>;              // label ids
export function setTaskLabels(supabase: Client, taskId: string, labelIds: string[]):
  Promise<{ error: string | null }>;

// lib/calendar/month.ts
export type DayCell = { date: string; inMonth: boolean };                 // date = "YYYY-MM-DD"
export function buildMonthGrid(year: number, month: number): DayCell[][];  // month: 1-12; weeks of 7, Monday-first
export function monthRange(year: number, month: number): { start: string; end: string };  // ISO instants, padded grid

// lib/activity/activity.ts
type ActivityRow = Database["flowdo"]["Tables"]["activity_logs"]["Row"];
export function listActivity(supabase: Client, opts: { taskId?: string; projectId?: string; limit?: number }):
  Promise<{ data: ActivityRow[] | null; error: string | null }>;

// lib/activity/format.ts
export function describeActivity(row: Pick<ActivityRow, "action" | "metadata">): string;

// lib/notifications/derive.ts
export type DerivedNotification = {
  key: string;
  type: "overdue" | "due-soon" | "daily-summary";
  title: string;
  message: string;
  taskId: string | null;
  createdAt: string;
};
export function deriveNotifications(tasks: TaskRow[], readKeys: Set<string>, now: Date): DerivedNotification[];

// lib/notifications/notifications.ts
export function listReadKeys(supabase: Client): Promise<{ data: string[] | null; error: string | null }>;
export function markRead(supabase: Client, userId: string, items: DerivedNotification[]): Promise<{ error: string | null }>;
export function markAllRead(supabase: Client, userId: string, items: DerivedNotification[]): Promise<{ error: string | null }>;
```

`TaskRow` everywhere means `Database["flowdo"]["Tables"]["tasks"]["Row"]`.

---

# WAVE A — Subtasks & Labels (no migration)

## Task A1: Subtask data layer + flat-view exclusion

**Files:**
- Create: `lib/tasks/subtasks.ts`, `lib/tasks/subtasks.test.ts`
- Modify: `lib/tasks/tasks.ts` (add `parentTaskId` to `ListTasksFilters` + `listTasks`), `lib/tasks/dashboard-stats.ts`, `lib/tasks/dashboard-stats.test.ts`
- Modify: `app/app/inbox/page.tsx`, `app/app/today/page.tsx`, `app/app/upcoming/page.tsx`, `app/app/completed/page.tsx`, `app/app/projects/[id]/page.tsx` (base filters)
- Test: `lib/tasks/subtasks.test.ts`, `tests/integration/subtasks.test.ts`

**Interfaces:**
- Consumes: `listTasks`, `createTask` patterns from `lib/tasks/tasks.ts`; `getTodayRange` from `lib/tasks/date-ranges.ts`.
- Produces: `subtaskProgress`, `listSubtasks`, `createSubtask` (signatures above); `ListTasksFilters.parentTaskId`.

- [ ] **Step 1: Write the failing unit test for `subtaskProgress`**

`lib/tasks/subtasks.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { subtaskProgress } from "./subtasks";

describe("subtaskProgress", () => {
  it("returns 0/0 for no subtasks", () => {
    expect(subtaskProgress([])).toEqual({ done: 0, total: 0 });
  });

  it("counts COMPLETED rows as done", () => {
    expect(
      subtaskProgress([{ status: "COMPLETED" }, { status: "TODO" }, { status: "COMPLETED" }])
    ).toEqual({ done: 2, total: 3 });
  });

  it("treats every non-COMPLETED status as not done", () => {
    expect(
      subtaskProgress([{ status: "IN_PROGRESS" }, { status: "CANCELLED" }])
    ).toEqual({ done: 0, total: 2 });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- lib/tasks/subtasks.test.ts`
Expected: FAIL — `subtaskProgress is not a function` / module not found.

- [ ] **Step 3: Implement `lib/tasks/subtasks.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type TaskRow = Database["flowdo"]["Tables"]["tasks"]["Row"];
type Client = SupabaseClient<Database, "flowdo">;

export function subtaskProgress(rows: { status: string }[]): { done: number; total: number } {
  return {
    done: rows.filter((r) => r.status === "COMPLETED").length,
    total: rows.length,
  };
}

export async function listSubtasks(supabase: Client, parentId: string) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("parent_task_id", parentId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return { data: null, error: "Couldn't load subtasks. Please try again." };
  return { data: data as TaskRow[], error: null };
}

export async function createSubtask(supabase: Client, userId: string, parentId: string, title: string) {
  const { data, error } = await supabase
    .from("tasks")
    .insert({ user_id: userId, parent_task_id: parentId, title, position: Date.now() })
    .select()
    .single();
  if (error) return { data: null, error: "Couldn't add subtask. Please try again." };
  return { data, error: null };
}
```

- [ ] **Step 4: Run the unit test to verify it passes**

Run: `npm test -- lib/tasks/subtasks.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Add `parentTaskId` to `listTasks`**

In `lib/tasks/tasks.ts`, extend `ListTasksFilters`:
```ts
export interface ListTasksFilters {
  projectId?: string | null;
  parentTaskId?: string | null;
  dueDate?: "today" | "upcoming" | "none";
  excludeCompleted?: boolean;
  status?: TaskStatus;
  priority?: TaskPriority;
  search?: string;
  sort?: "due_date" | "priority" | "created_at" | "alphabetical" | "manual" | "completed_at";
  limit?: number;
}
```
And in `listTasks`, right after the `projectId` block:
```ts
  if (filters.parentTaskId !== undefined) {
    query =
      filters.parentTaskId === null
        ? query.is("parent_task_id", null)
        : query.eq("parent_task_id", filters.parentTaskId);
  }
```

- [ ] **Step 6: Add `parentTaskId: null` to every flat-view base filter**

- `app/app/inbox/page.tsx`: `const baseFilters = { projectId: null, parentTaskId: null, excludeCompleted: true } as const;`
- `app/app/today/page.tsx`: `const baseFilters = { dueDate: "today", parentTaskId: null, excludeCompleted: true } as const;`
- `app/app/upcoming/page.tsx`: `const baseFilters = { dueDate: "upcoming", parentTaskId: null, excludeCompleted: true } as const;`
- `app/app/completed/page.tsx`: `const baseFilters = { status: "COMPLETED", parentTaskId: null, sort: "completed_at" } as const;`
- `app/app/projects/[id]/page.tsx`: `const baseFilters = { projectId: project.id, parentTaskId: null, excludeCompleted: true } as const;`

(`upcoming/page.tsx` mirrors `today/page.tsx`; open it to confirm the exact object.)

- [ ] **Step 7: Exclude subtasks in `computeDashboardStats` — write the failing test first**

Add to `lib/tasks/dashboard-stats.test.ts`:
```ts
  it("excludes subtasks (parent_task_id set) from today and overdue counts", () => {
    const tasks = [
      task({ due_date: "2026-03-15T09:00:00.000Z", status: "TODO" }),
      { ...task({ due_date: "2026-03-15T09:00:00.000Z", status: "TODO" }), parent_task_id: "p1" },
      { ...task({ due_date: "2026-03-10T09:00:00.000Z", status: "TODO" }), parent_task_id: "p1" },
    ] as never[];
    const stats = computeDashboardStats(tasks, now);
    expect(stats.todayTotal).toBe(1);
    expect(stats.overdueCount).toBe(0);
  });
```

- [ ] **Step 8: Run it to verify it fails**

Run: `npm test -- lib/tasks/dashboard-stats.test.ts`
Expected: FAIL — `todayTotal` is 2, `overdueCount` is 1.

- [ ] **Step 9: Implement the exclusion**

In `lib/tasks/dashboard-stats.ts`, first line of `computeDashboardStats`:
```ts
export function computeDashboardStats(tasks: TaskRow[], now: Date = new Date()) {
  const topLevel = tasks.filter((t) => t.parent_task_id === null);
  const { start, end } = getTodayRange(now);

  const todayTasks = topLevel.filter((t) => t.due_date && isWithinRange(t.due_date, start, end));
  const todayCompleted = todayTasks.filter((t) => t.status === "COMPLETED").length;

  const overdueCount = topLevel.filter(
    (t) => t.status !== "COMPLETED" && t.due_date && isBefore(t.due_date, start)
  ).length;

  return { todayTotal: todayTasks.length, todayCompleted, overdueCount };
}
```

- [ ] **Step 10: Run unit tests**

Run: `npm test -- lib/tasks/`
Expected: PASS.

- [ ] **Step 11: Write the integration test**

`tests/integration/subtasks.test.ts`:
```ts
import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient } from "../helpers/admin-client";
import { createConfirmedTestUser } from "../helpers/test-user";
import { createTask, listTasks } from "@/lib/tasks/tasks";
import { createSubtask, listSubtasks } from "@/lib/tasks/subtasks";

const admin = createAdminClient();
const createdUserIds: string[] = [];

afterEach(async () => {
  for (const id of createdUserIds.splice(0)) await admin.auth.admin.deleteUser(id);
});

describe("subtasks", () => {
  it("creates subtasks under a parent and lists them", async () => {
    const owner = await createConfirmedTestUser(admin, "subtasks-owner@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const { data: parent } = await createTask(owner.client, owner.userId, { title: "Parent" });
    await createSubtask(owner.client, owner.userId, parent!.id, "Sub 1");
    await createSubtask(owner.client, owner.userId, parent!.id, "Sub 2");

    const { data: subs } = await listSubtasks(owner.client, parent!.id);
    expect(subs?.map((s) => s.title)).toEqual(["Sub 1", "Sub 2"]);
  });

  it("subtasks are excluded from a parentTaskId: null listing", async () => {
    const owner = await createConfirmedTestUser(admin, "subtasks-exclude@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const { data: parent } = await createTask(owner.client, owner.userId, { title: "Parent" });
    await createSubtask(owner.client, owner.userId, parent!.id, "Hidden sub");

    const { data: topLevel } = await listTasks(owner.client, { parentTaskId: null });
    expect(topLevel?.map((t) => t.title)).toEqual(["Parent"]);
  });

  it("a different user cannot create a subtask under someone else's task", async () => {
    const owner = await createConfirmedTestUser(admin, "subtasks-rls-owner@example.com", "Password123!");
    const attacker = await createConfirmedTestUser(admin, "subtasks-rls-attacker@example.com", "Password123!");
    createdUserIds.push(owner.userId, attacker.userId);

    const { data: parent } = await createTask(owner.client, owner.userId, { title: "Private parent" });
    const { data, error } = await createSubtask(attacker.client, attacker.userId, parent!.id, "intrusion");
    // RLS: the attacker's insert with their own user_id is allowed by tasks_insert_own,
    // but the row is theirs, not a child visible to the owner. Assert the owner never sees it.
    expect(error).toBeNull();
    const { data: ownerSubs } = await listSubtasks(owner.client, parent!.id);
    expect(ownerSubs).toEqual([]);
    if (data) await admin.from("tasks").delete().eq("id", data.id);
  });
});
```

- [ ] **Step 12: Run the integration test**

Run: `npx supabase start` (if not running) then `npm run test:integration -- tests/integration/subtasks.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 13: Lint + typecheck + full unit suite**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all PASS.

- [ ] **Step 14: Commit**

```bash
git add lib/tasks/subtasks.ts lib/tasks/subtasks.test.ts lib/tasks/tasks.ts \
  lib/tasks/dashboard-stats.ts lib/tasks/dashboard-stats.test.ts \
  app/app/inbox/page.tsx app/app/today/page.tsx app/app/upcoming/page.tsx \
  app/app/completed/page.tsx "app/app/projects/[id]/page.tsx" \
  tests/integration/subtasks.test.ts
git commit -m "FLOWDO-4.1: add subtask data layer and exclude subtasks from flat views

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```

---

## Task A2: Subtask section in the detail panel (+ panel split)

**Files:**
- Create: `components/tasks/subtask-section.tsx`, `components/tasks/subtask-section.test.tsx`
- Modify: `components/tasks/task-detail-panel.tsx` (mount `<SubtaskSection>`), `components/tasks/task-view.tsx` (pass `userId` through — already available)
- Test: `components/tasks/subtask-section.test.tsx`

**Interfaces:**
- Consumes: `subtaskProgress`, `listSubtasks`, `createSubtask` (Task A1); `completeTask`, `reopenTask`, `deleteTask` from `lib/tasks/tasks.ts`; `createClient` from `lib/supabase/client.ts`.
- Produces: `<SubtaskSection taskId={string} userId={string} />` — self-contained, manages its own TanStack Query state under key `["subtasks", taskId]`.

- [ ] **Step 1: Write the failing component test**

`components/tasks/subtask-section.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SubtaskSection } from "./subtask-section";

const listSubtasks = vi.fn();
const createSubtask = vi.fn();
const completeTask = vi.fn();
const reopenTask = vi.fn();
const deleteTask = vi.fn();

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/tasks/subtasks", async (orig) => ({
  ...(await orig<typeof import("./subtasks")>()),
  listSubtasks: (...a: unknown[]) => listSubtasks(...a),
  createSubtask: (...a: unknown[]) => createSubtask(...a),
}));
vi.mock("@/lib/tasks/tasks", () => ({
  completeTask: (...a: unknown[]) => completeTask(...a),
  reopenTask: (...a: unknown[]) => reopenTask(...a),
  deleteTask: (...a: unknown[]) => deleteTask(...a),
}));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  listSubtasks.mockResolvedValue({
    data: [
      { id: "s1", title: "First", status: "COMPLETED" },
      { id: "s2", title: "Second", status: "TODO" },
    ],
    error: null,
  });
  createSubtask.mockResolvedValue({ data: { id: "s3", title: "Third", status: "TODO" }, error: null });
  completeTask.mockResolvedValue({ error: null });
  reopenTask.mockResolvedValue({ error: null });
});

describe("SubtaskSection", () => {
  it("shows progress as done/total with a bar", async () => {
    wrap(<SubtaskSection taskId="t1" userId="u1" />);
    expect(await screen.findByText("1 / 2 completed")).toBeInTheDocument();
  });

  it("adds a subtask via the inline input", async () => {
    const user = userEvent.setup();
    wrap(<SubtaskSection taskId="t1" userId="u1" />);
    await screen.findByText("1 / 2 completed");
    await user.type(screen.getByPlaceholderText(/add a subtask/i), "Third{Enter}");
    expect(createSubtask).toHaveBeenCalledWith(expect.anything(), "u1", "t1", "Third");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- components/tasks/subtask-section.test.tsx`
Expected: FAIL — module `./subtask-section` not found.

- [ ] **Step 3: Implement `components/tasks/subtask-section.tsx`**

```tsx
"use client";
import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { listSubtasks, createSubtask, subtaskProgress } from "@/lib/tasks/subtasks";
import { completeTask, reopenTask, deleteTask } from "@/lib/tasks/tasks";

export function SubtaskSection({ taskId, userId }: { taskId: string; userId: string }) {
  const supabase = createClient();
  const qc = useQueryClient();
  const [title, setTitle] = React.useState("");
  const queryKey = ["subtasks", taskId];

  const { data: subtasks = [] } = useQuery({
    queryKey,
    queryFn: async () => (await listSubtasks(supabase, taskId)).data ?? [],
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey });
    qc.invalidateQueries({ queryKey: ["tasks"] });
  }

  const add = useMutation({
    mutationFn: (t: string) => createSubtask(supabase, userId, taskId, t),
    onSuccess: () => { setTitle(""); invalidate(); },
  });
  const toggle = useMutation({
    mutationFn: (s: { id: string; status: string }) =>
      s.status === "COMPLETED" ? reopenTask(supabase, s.id) : completeTask(supabase, s.id),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteTask(supabase, id),
    onSuccess: invalidate,
  });

  const { done, total } = subtaskProgress(subtasks);
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <section className="space-y-2 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Subtasks</h3>
        {total > 0 && <span className="text-xs text-muted-foreground">{done} / {total} completed</span>}
      </div>
      {total > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar"
             aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      )}
      <ul className="space-y-1">
        {subtasks.map((s) => (
          <li key={s.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={s.status === "COMPLETED"}
              onChange={() => toggle.mutate(s)}
              aria-label={s.status === "COMPLETED" ? "Reopen subtask" : "Complete subtask"}
              className="h-4 w-4 rounded border-border"
            />
            <span className={s.status === "COMPLETED" ? "flex-1 text-sm text-muted-foreground line-through" : "flex-1 text-sm"}>
              {s.title}
            </span>
            <button type="button" aria-label="Delete subtask" onClick={() => remove.mutate(s.id)}
                    className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && title.trim()) add.mutate(title.trim());
        }}
        placeholder="Add a subtask, press Enter…"
        className="w-full rounded-md border border-dashed border-border px-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />
    </section>
  );
}
```

- [ ] **Step 4: Run the component test to verify it passes**

Run: `npm test -- components/tasks/subtask-section.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Mount it in the detail panel**

In `components/tasks/task-detail-panel.tsx`, add the import and a `userId` prop, then render `<SubtaskSection>` after the project `<select>` block and before the Delete/Save footer:
```tsx
// add to the imports
import { SubtaskSection } from "./subtask-section";

// add userId to the component's props type and destructure it:
//   userId, task, projects, open, onOpenChange, onSave, onDelete

// inside the <form>, after the Project field div, before the footer:
        <SubtaskSection taskId={task.id} userId={userId} />
```

- [ ] **Step 6: Pass `userId` from `task-view.tsx`**

In `components/tasks/task-view.tsx`, the `<TaskDetailPanel>` render gains `userId={userId}` (the component already receives `userId` as a prop):
```tsx
        <TaskDetailPanel
          task={openTask}
          projects={projects}
          userId={userId}
          open={!!openTask}
          ...
```

- [ ] **Step 7: Run lint + typecheck + unit suite**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all PASS. (The existing `task-detail-panel.test.tsx` may need `userId="u1"` added to its render — update it if typecheck/test flags it.)

- [ ] **Step 8: Commit**

```bash
git add components/tasks/subtask-section.tsx components/tasks/subtask-section.test.tsx \
  components/tasks/task-detail-panel.tsx components/tasks/task-view.tsx \
  components/tasks/task-detail-panel.test.tsx
git commit -m "FLOWDO-4.2: add subtask section with progress bar to task detail

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```

---

## Task A3: Labels + task_labels data layer (+ database types)

**Files:**
- Create: `lib/labels/labels.ts`, `lib/tasks/task-labels.ts`
- Modify: `types/database.ts` (add `labels`, `task_labels`, `notifications`, `activity_logs` table types now — every later task needs them), `lib/validations/tasks.ts` (+ `labelSchema`), `lib/validations/tasks.test.ts`
- Test: `tests/integration/labels.test.ts`

**Interfaces:**
- Consumes: existing `lib/projects/projects.ts` CRUD shape.
- Produces: `listLabels`/`createLabel`/`updateLabel`/`deleteLabel`, `listTaskLabels`/`setTaskLabels` (signatures above); `labelSchema`.

- [ ] **Step 1: Add the missing table types to `types/database.ts`**

Inside `Database["flowdo"]["Tables"]`, after `projects`, add:
```ts
      labels: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          created_at: string;
        };
        Insert: Partial<Database["flowdo"]["Tables"]["labels"]["Row"]> & { user_id: string; name: string };
        Update: Partial<Database["flowdo"]["Tables"]["labels"]["Row"]>;
        Relationships: [];
      };
      task_labels: {
        Row: { task_id: string; label_id: string };
        Insert: { task_id: string; label_id: string };
        Update: Partial<{ task_id: string; label_id: string }>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          task_id: string | null;
          type: string;
          title: string;
          message: string | null;
          is_read: boolean;
          created_at: string;
          dedupe_key: string | null;
        };
        Insert: Partial<Database["flowdo"]["Tables"]["notifications"]["Row"]> & { user_id: string; type: string; title: string };
        Update: Partial<Database["flowdo"]["Tables"]["notifications"]["Row"]>;
        Relationships: [];
      };
      activity_logs: {
        Row: {
          id: string;
          user_id: string;
          task_id: string | null;
          project_id: string | null;
          action: string;
          metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: Partial<Database["flowdo"]["Tables"]["activity_logs"]["Row"]> & { user_id: string; action: string };
        Update: Partial<Database["flowdo"]["Tables"]["activity_logs"]["Row"]>;
        Relationships: [];
      };
```
(`dedupe_key` is added to the DB in migration `0009` in Wave C; typing it now as `string | null` is harmless because it is nullable.)

Also add `recurrence` + `recurrence_rule` to the `tasks` `Row` now, same reasoning (columns land in `0007`, Wave B):
```ts
          // ...existing tasks Row fields, then:
          recurrence: "NEVER" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | "CUSTOM";
          recurrence_rule: { interval: number; unit: "day" | "week" | "month" | "year" } | null;
```

- [ ] **Step 2: Write the failing `labelSchema` test**

Add to `lib/validations/tasks.test.ts`:
```ts
import { labelSchema } from "./tasks";

describe("labelSchema", () => {
  it("accepts a trimmed name and a colour", () => {
    expect(labelSchema.parse({ name: "  Work ", color: "#4F46E5" })).toEqual({ name: "Work", color: "#4F46E5" });
  });
  it("rejects an empty name", () => {
    expect(labelSchema.safeParse({ name: "  ", color: "#4F46E5" }).success).toBe(false);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -- lib/validations/tasks.test.ts`
Expected: FAIL — `labelSchema` is not exported.

- [ ] **Step 4: Add `labelSchema` to `lib/validations/tasks.ts`**

```ts
export const labelSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  color: z.string().min(1, "Pick a colour"),
});
export type LabelInput = z.infer<typeof labelSchema>;
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npm test -- lib/validations/tasks.test.ts`
Expected: PASS.

- [ ] **Step 6: Implement `lib/labels/labels.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type LabelRow = Database["flowdo"]["Tables"]["labels"]["Row"];
type Client = SupabaseClient<Database, "flowdo">;

export async function listLabels(supabase: Client) {
  const { data, error } = await supabase.from("labels").select("*").order("name", { ascending: true });
  if (error) return { data: null, error: "Couldn't load labels. Please try again." };
  return { data: data as LabelRow[], error: null };
}

export async function createLabel(supabase: Client, userId: string, input: { name: string; color: string }) {
  const { data, error } = await supabase
    .from("labels")
    .insert({ user_id: userId, name: input.name, color: input.color })
    .select()
    .single();
  if (error) {
    return {
      data: null,
      error: error.code === "23505" ? "You already have a label with that name." : "Couldn't create label. Please try again.",
    };
  }
  return { data, error: null };
}

export async function updateLabel(supabase: Client, labelId: string, input: { name?: string; color?: string }) {
  const patch: Database["flowdo"]["Tables"]["labels"]["Update"] = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.color !== undefined) patch.color = input.color;
  const { data, error } = await supabase.from("labels").update(patch).eq("id", labelId).select().single();
  if (error) return { data: null, error: "Couldn't update label. Please try again." };
  return { data, error: null };
}

export async function deleteLabel(supabase: Client, labelId: string) {
  const { error } = await supabase.from("labels").delete().eq("id", labelId);
  if (error) return { error: "Couldn't delete label. Please try again." };
  return { error: null };
}
```

- [ ] **Step 7: Implement `lib/tasks/task-labels.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database, "flowdo">;

export async function listTaskLabels(supabase: Client, taskId: string) {
  const { data, error } = await supabase.from("task_labels").select("label_id").eq("task_id", taskId);
  if (error) return { data: null, error: "Couldn't load task labels. Please try again." };
  return { data: (data ?? []).map((r) => r.label_id), error: null };
}

export async function setTaskLabels(supabase: Client, taskId: string, labelIds: string[]) {
  const { data: current, error: readError } = await supabase
    .from("task_labels")
    .select("label_id")
    .eq("task_id", taskId);
  if (readError) return { error: "Couldn't update task labels. Please try again." };

  const currentIds = new Set((current ?? []).map((r) => r.label_id));
  const nextIds = new Set(labelIds);
  const toAdd = labelIds.filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !nextIds.has(id));

  if (toRemove.length > 0) {
    const { error } = await supabase.from("task_labels").delete().eq("task_id", taskId).in("label_id", toRemove);
    if (error) return { error: "Couldn't update task labels. Please try again." };
  }
  if (toAdd.length > 0) {
    const { error } = await supabase.from("task_labels").insert(toAdd.map((label_id) => ({ task_id: taskId, label_id })));
    if (error) return { error: "Couldn't update task labels. Please try again." };
  }
  return { error: null };
}
```

- [ ] **Step 8: Write the integration test**

`tests/integration/labels.test.ts`:
```ts
import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient } from "../helpers/admin-client";
import { createConfirmedTestUser } from "../helpers/test-user";
import { createTask } from "@/lib/tasks/tasks";
import { createLabel, listLabels, updateLabel, deleteLabel } from "@/lib/labels/labels";
import { setTaskLabels, listTaskLabels } from "@/lib/tasks/task-labels";

const admin = createAdminClient();
const createdUserIds: string[] = [];
afterEach(async () => {
  for (const id of createdUserIds.splice(0)) await admin.auth.admin.deleteUser(id);
});

describe("labels", () => {
  it("CRUDs a label owned by the caller", async () => {
    const owner = await createConfirmedTestUser(admin, "labels-crud@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const { data: label, error } = await createLabel(owner.client, owner.userId, { name: "Work", color: "#4F46E5" });
    expect(error).toBeNull();
    expect(label?.name).toBe("Work");

    await updateLabel(owner.client, label!.id, { name: "Job" });
    const { data: labels } = await listLabels(owner.client);
    expect(labels?.map((l) => l.name)).toEqual(["Job"]);

    await deleteLabel(owner.client, label!.id);
    const { data: afterDelete } = await listLabels(owner.client);
    expect(afterDelete).toEqual([]);
  });

  it("rejects a duplicate label name for the same user", async () => {
    const owner = await createConfirmedTestUser(admin, "labels-dup@example.com", "Password123!");
    createdUserIds.push(owner.userId);
    await createLabel(owner.client, owner.userId, { name: "Home", color: "#16A34A" });
    const { error } = await createLabel(owner.client, owner.userId, { name: "Home", color: "#16A34A" });
    expect(error).toMatch(/already have a label/i);
  });

  it("setTaskLabels adds and removes the diff", async () => {
    const owner = await createConfirmedTestUser(admin, "labels-assign@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const { data: task } = await createTask(owner.client, owner.userId, { title: "Tagged" });
    const { data: a } = await createLabel(owner.client, owner.userId, { name: "A", color: "#4F46E5" });
    const { data: b } = await createLabel(owner.client, owner.userId, { name: "B", color: "#DC2626" });

    await setTaskLabels(owner.client, task!.id, [a!.id, b!.id]);
    expect((await listTaskLabels(owner.client, task!.id)).data?.sort()).toEqual([a!.id, b!.id].sort());

    await setTaskLabels(owner.client, task!.id, [b!.id]);
    expect((await listTaskLabels(owner.client, task!.id)).data).toEqual([b!.id]);
  });

  it("a different user cannot read or tag with the owner's label", async () => {
    const owner = await createConfirmedTestUser(admin, "labels-rls-owner@example.com", "Password123!");
    const attacker = await createConfirmedTestUser(admin, "labels-rls-attacker@example.com", "Password123!");
    createdUserIds.push(owner.userId, attacker.userId);

    const { data: label } = await createLabel(owner.client, owner.userId, { name: "Secret", color: "#4F46E5" });
    const { data: attackerLabels } = await listLabels(attacker.client);
    expect(attackerLabels?.find((l) => l.id === label!.id)).toBeUndefined();

    const { data: attackerTask } = await createTask(attacker.client, attacker.userId, { title: "atk" });
    const { error } = await setTaskLabels(attacker.client, attackerTask!.id, [label!.id]);
    expect(error).toMatch(/couldn't update task labels/i); // task_labels_insert_own blocks it
  });
});
```

- [ ] **Step 9: Run the integration test**

Run: `npm run test:integration -- tests/integration/labels.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 10: Lint + typecheck + unit suite**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all PASS.

- [ ] **Step 11: Commit**

```bash
git add types/database.ts lib/labels/labels.ts lib/tasks/task-labels.ts \
  lib/validations/tasks.ts lib/validations/tasks.test.ts tests/integration/labels.test.ts
git commit -m "FLOWDO-4.3: add label and task-label data layer

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```

---

## Task A4: Label filter in `listTasks` + URL param

**Files:**
- Modify: `lib/tasks/tasks.ts` (`labelId` filter), `lib/tasks/filter-params.ts` (`label` param), `lib/tasks/filter-params.test.ts` (if it exists — else create a case in a new/adjacent test)
- Test: `lib/tasks/filter-params.test.ts`, `tests/integration/labels.test.ts` (add a case)

**Interfaces:**
- Consumes: `ListTasksFilters` (Task A1), `task_labels` embed.
- Produces: `ListTasksFilters.labelId`; `label` recognised by `parseFilterParams` / `buildFullFilters`.

- [ ] **Step 1: Write the failing filter-params test**

Add to `lib/tasks/filter-params.test.ts`:
```ts
  it("parses a label id from the `label` param", () => {
    const parsed = parseFilterParams({ label: "b1e6d2a0-0000-4000-8000-000000000000" });
    expect(parsed.labelId).toBe("b1e6d2a0-0000-4000-8000-000000000000");
  });
  it("ignores a non-uuid `label` param", () => {
    expect(parseFilterParams({ label: "not-a-uuid" }).labelId).toBeUndefined();
  });
```
(If the file imports `parseFilterParams` differently, match the existing import.)

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- lib/tasks/filter-params.test.ts`
Expected: FAIL — `labelId` undefined / not parsed.

- [ ] **Step 3: Add `label` parsing to `lib/tasks/filter-params.ts`**

```ts
export type UserFilterParams = Pick<ListTasksFilters, "status" | "priority" | "search" | "sort" | "labelId">;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// inside parseFilterParams, before `return result;`
  const label = firstValue(params.label);
  if (label && UUID_RE.test(label)) {
    result.labelId = label;
  }
```
And in `buildFullFilters`, nothing extra is needed — `labelId` rides along in `userFilters`.

- [ ] **Step 4: Add `labelId` to `ListTasksFilters` and `listTasks`**

In `lib/tasks/tasks.ts`:
```ts
// ListTasksFilters: add
  labelId?: string;

// in listTasks, replace the opening `.select("*")` with a conditional select+filter:
  let query = filters.labelId
    ? supabase.from("tasks").select("*, task_labels!inner(label_id)").eq("task_labels.label_id", filters.labelId)
    : supabase.from("tasks").select("*");
```
(The `!inner` embed filters tasks to those having a matching `task_labels` row. The extra `task_labels` key on each row is ignored by every consumer, which reads typed `TaskRow` fields only.)

- [ ] **Step 5: Run the unit test to verify it passes**

Run: `npm test -- lib/tasks/filter-params.test.ts`
Expected: PASS.

- [ ] **Step 6: Add an integration case for the label filter**

Append to `tests/integration/labels.test.ts` `describe("labels")`:
```ts
  it("listTasks filters to only tasks carrying the label", async () => {
    const { listTasks } = await import("@/lib/tasks/tasks");
    const owner = await createConfirmedTestUser(admin, "labels-filter@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const { data: tagged } = await createTask(owner.client, owner.userId, { title: "Tagged" });
    await createTask(owner.client, owner.userId, { title: "Untagged" });
    const { data: label } = await createLabel(owner.client, owner.userId, { name: "Focus", color: "#4F46E5" });
    await setTaskLabels(owner.client, tagged!.id, [label!.id]);

    const { data: filtered } = await listTasks(owner.client, { labelId: label!.id });
    expect(filtered?.map((t) => t.title)).toEqual(["Tagged"]);
  });
```

- [ ] **Step 7: Run integration + lint + typecheck + unit**

Run: `npm run test:integration -- tests/integration/labels.test.ts && npm run lint && npm run typecheck && npm test`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/tasks/tasks.ts lib/tasks/filter-params.ts lib/tasks/filter-params.test.ts \
  tests/integration/labels.test.ts
git commit -m "FLOWDO-4.4: filter task lists by label via ?label= param

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```

---

## Task A5: Manage-labels dialog + label picker (in detail panel)

**Files:**
- Create: `components/labels/manage-labels-dialog.tsx`, `components/labels/manage-labels-dialog.test.tsx`, `components/tasks/label-picker.tsx`, `components/tasks/label-picker.test.tsx`
- Modify: `components/tasks/task-detail-panel.tsx` (mount `<LabelPicker>`), `components/tasks/task-view.tsx` (pass `labels`, wire `setTaskLabels` into `saveMutation`)
- Test: the two new `.test.tsx`

**Interfaces:**
- Consumes: `listLabels`/`createLabel`/`updateLabel`/`deleteLabel` (A3), `listTaskLabels`/`setTaskLabels` (A3), `PROJECT_COLORS`.
- Produces: `<ManageLabelsDialog open onOpenChange />`, `<LabelPicker taskId value onChange />` where `value: string[]`, `onChange: (ids: string[]) => void`.

- [ ] **Step 1: Write the failing `ManageLabelsDialog` test**

`components/labels/manage-labels-dialog.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ManageLabelsDialog } from "./manage-labels-dialog";

const listLabels = vi.fn();
const createLabel = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/labels/labels", () => ({
  listLabels: (...a: unknown[]) => listLabels(...a),
  createLabel: (...a: unknown[]) => createLabel(...a),
  updateLabel: vi.fn().mockResolvedValue({ data: {}, error: null }),
  deleteLabel: vi.fn().mockResolvedValue({ error: null }),
}));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  listLabels.mockResolvedValue({ data: [{ id: "l1", name: "Work", color: "#4F46E5" }], error: null });
  createLabel.mockResolvedValue({ data: { id: "l2", name: "Home", color: "#16A34A" }, error: null });
});

describe("ManageLabelsDialog", () => {
  it("lists existing labels", async () => {
    wrap(<ManageLabelsDialog open userId="u1" onOpenChange={() => {}} />);
    expect(await screen.findByDisplayValue("Work")).toBeInTheDocument();
  });

  it("creates a label from the add row", async () => {
    const user = userEvent.setup();
    wrap(<ManageLabelsDialog open userId="u1" onOpenChange={() => {}} />);
    await screen.findByDisplayValue("Work");
    await user.type(screen.getByPlaceholderText(/new label name/i), "Home");
    await user.click(screen.getByRole("button", { name: /add label/i }));
    expect(createLabel).toHaveBeenCalledWith(expect.anything(), "u1", { name: "Home", color: expect.any(String) });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- components/labels/manage-labels-dialog.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `components/labels/manage-labels-dialog.tsx`**

```tsx
"use client";
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { listLabels, createLabel, updateLabel, deleteLabel } from "@/lib/labels/labels";
import { PROJECT_COLORS } from "@/lib/constants/project-colors";
import { Button } from "@/components/ui/button";

export function ManageLabelsDialog({
  open,
  userId,
  onOpenChange,
}: {
  open: boolean;
  userId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const supabase = createClient();
  const qc = useQueryClient();
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState(PROJECT_COLORS[0].value);

  const { data: labels = [] } = useQuery({
    queryKey: ["labels"],
    queryFn: async () => (await listLabels(supabase)).data ?? [],
  });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["labels"] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  const add = useMutation({
    mutationFn: () => createLabel(supabase, userId, { name: name.trim(), color }),
    onSuccess: (r) => { if (!r.error) { setName(""); invalidate(); } },
  });
  const rename = useMutation({
    mutationFn: (v: { id: string; name: string }) => updateLabel(supabase, v.id, { name: v.name }),
    onSuccess: invalidate,
  });
  const recolor = useMutation({
    mutationFn: (v: { id: string; color: string }) => updateLabel(supabase, v.id, { color: v.color }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteLabel(supabase, id),
    onSuccess: invalidate,
  });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-lg bg-background p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">Labels</Dialog.Title>
            <Dialog.Close aria-label="Close"><X className="h-5 w-5" /></Dialog.Close>
          </div>

          <ul className="space-y-2">
            {labels.map((l) => (
              <li key={l.id} className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label={`Colour for ${l.name}`}
                  value={l.color}
                  onChange={(e) => recolor.mutate({ id: l.id, color: e.target.value })}
                  className="h-6 w-6 rounded border border-border"
                />
                <input
                  aria-label={`Name for ${l.name}`}
                  defaultValue={l.name}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== l.name && rename.mutate({ id: l.id, name: e.target.value.trim() })}
                  className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
                />
                <button type="button" aria-label={`Delete ${l.name}`} onClick={() => remove.mutate(l.id)}
                        className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2 border-t border-border pt-3">
            <select aria-label="New label colour" value={color} onChange={(e) => setColor(e.target.value)}
                    className="h-9 rounded-md border border-border bg-background px-2 text-sm">
              {PROJECT_COLORS.map((c) => <option key={c.value} value={c.value}>{c.name}</option>)}
            </select>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New label name"
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
            />
            <Button type="button" size="sm" disabled={!name.trim()} onClick={() => add.mutate()}>Add label</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- components/labels/manage-labels-dialog.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the failing `LabelPicker` test**

`components/tasks/label-picker.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LabelPicker } from "./label-picker";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/labels/labels", () => ({
  listLabels: vi.fn().mockResolvedValue({
    data: [{ id: "l1", name: "Work", color: "#4F46E5" }, { id: "l2", name: "Home", color: "#16A34A" }],
    error: null,
  }),
}));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => vi.clearAllMocks());

describe("LabelPicker", () => {
  it("toggles a label id in and out of value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function Harness() {
      const [v, setV] = (globalThis as any).React?.useState?.([]) ?? [[], () => {}];
      return <LabelPicker userId="u1" value={v} onChange={(next) => { setV(next); onChange(next); }} />;
    }
    wrap(<LabelPicker userId="u1" value={[]} onChange={onChange} />);
    await user.click(await screen.findByRole("button", { name: "Work" }));
    expect(onChange).toHaveBeenCalledWith(["l1"]);
  });

  it("shows a selected label as pressed", async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <LabelPicker userId="u1" value={["l2"]} onChange={() => {}} />
      </QueryClientProvider>
    );
    const home = await screen.findByRole("button", { name: "Home" });
    expect(home).toHaveAttribute("aria-pressed", "true");
  });
});
```
(Drop the unused `Harness` if the reviewer prefers; the two `it` blocks are what matters.)

- [ ] **Step 6: Run it to verify it fails**

Run: `npm test -- components/tasks/label-picker.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement `components/tasks/label-picker.tsx`**

```tsx
"use client";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { listLabels } from "@/lib/labels/labels";
import { ManageLabelsDialog } from "@/components/labels/manage-labels-dialog";

export function LabelPicker({
  userId,
  value,
  onChange,
}: {
  userId: string;
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const supabase = createClient();
  const [managing, setManaging] = React.useState(false);
  const { data: labels = [] } = useQuery({
    queryKey: ["labels"],
    queryFn: async () => (await listLabels(supabase)).data ?? [],
  });

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {labels.map((l) => {
          const on = value.includes(l.id);
          return (
            <button
              key={l.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(l.id)}
              className={
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs " +
                (on ? "border-transparent text-primary-foreground" : "border-border text-muted-foreground")
              }
              style={on ? { backgroundColor: l.color } : undefined}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} aria-hidden="true" />
              {l.name}
            </button>
          );
        })}
        <button type="button" onClick={() => setManaging(true)}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground">
          <Plus className="h-3 w-3" /> New label
        </button>
      </div>
      {managing && <ManageLabelsDialog open userId={userId} onOpenChange={setManaging} />}
    </div>
  );
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm test -- components/tasks/label-picker.test.tsx`
Expected: PASS.

- [ ] **Step 9: Mount `<LabelPicker>` in the detail panel and wire `setTaskLabels`**

In `components/tasks/task-detail-panel.tsx`:
- import `LabelPicker`, `listTaskLabels` (from `@/lib/tasks/task-labels`), `useQuery` (from `@tanstack/react-query`), `createClient` (from `@/lib/supabase/client`).
- add local state `const [labelIds, setLabelIds] = React.useState<string[]>([])`.
- `useQuery({ queryKey: ["task-labels", task.id], queryFn: async () => (await listTaskLabels(createClient(), task.id)).data ?? [] })` and a `React.useEffect` to seed `setLabelIds` from that data when it loads.
- render, below the Project field: `<div className="space-y-2"><Label>Labels</Label><LabelPicker userId={userId} value={labelIds} onChange={setLabelIds} /></div>`
- change `onSubmit` to also persist labels: after `await onSave(task.id, values);` call `await onSave` as today, and add `onLabelsChange?: (taskId: string, labelIds: string[]) => Promise<void>` prop, invoked with `(task.id, labelIds)`.

In `components/tasks/task-view.tsx`:
- import `setTaskLabels` from `@/lib/tasks/task-labels`.
- pass `onLabelsChange={async (taskId, ids) => { const r = await setTaskLabels(supabase, taskId, ids); reportError(r); }}` to `<TaskDetailPanel>`.

- [ ] **Step 10: Lint + typecheck + unit suite**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all PASS (update `task-detail-panel.test.tsx` render props if flagged — add `userId="u1"` and `onLabelsChange={vi.fn()}`).

- [ ] **Step 11: Commit**

```bash
git add components/labels/ components/tasks/label-picker.tsx components/tasks/label-picker.test.tsx \
  components/tasks/task-detail-panel.tsx components/tasks/task-view.tsx components/tasks/task-detail-panel.test.tsx
git commit -m "FLOWDO-4.3: add label management dialog and task label picker

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```

---

## Task A6: Label filter dropdown + label chips on rows

**Files:**
- Modify: `components/tasks/task-filters.tsx` (label `<select>` + "Manage labels"), `components/tasks/task-view.tsx` (parse/serialise `label`, pass labels), `components/tasks/task-row.tsx` (chips), `components/tasks/task-list.tsx` (thread a `labelsByTask` prop or fetch per row — see step 3)
- Test: `components/tasks/task-filters.test.tsx` (add a case)

**Interfaces:**
- Consumes: `listLabels` (A3), `?label=` param (A4).
- Produces: label filter UI writing `?label=<id>`; row chips.

- [ ] **Step 1: Write the failing filter test**

Add to `components/tasks/task-filters.test.tsx` (match its existing mock/wrap setup; if it renders `<TaskFilters>` directly, add):
```tsx
  it("calls onChange with a labelId when a label is picked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TaskFilters
        currentFilters={{}}
        onChange={onChange}
        projects={[]}
        labels={[{ id: "l1", name: "Work", color: "#4F46E5" }] as never}
      />
    );
    await user.selectOptions(screen.getByLabelText("Label"), "l1");
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ labelId: "l1" }));
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- components/tasks/task-filters.test.tsx`
Expected: FAIL — no `Label` control / `labels` prop unknown.

- [ ] **Step 3: Add the label `<select>` to `TaskFilters`**

- Add props: `labels: Database["flowdo"]["Tables"]["labels"]["Row"][]` and `showLabelFilter?: boolean` (default `true`).
- Extend `UserFilterParams & { projectId?: string }` usage to also carry `labelId?: string` (it already does via A4's `UserFilterParams` change).
- After the priority `<select>`, add:
```tsx
      {showLabelFilter && (
        <select
          aria-label="Label"
          value={currentFilters.labelId ?? ""}
          onChange={(e) => onChange({ ...currentFilters, labelId: e.target.value || undefined })}
          className="h-10 rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="">Any label</option>
          {labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      )}
```

- [ ] **Step 4: Serialise `label` in `task-view.tsx`**

In `components/tasks/task-view.tsx`:
- add `labels` to `TaskView` props: `labels: Database["flowdo"]["Tables"]["labels"]["Row"][]`.
- `userFilters` gains `labelId: searchParams.get("label") ?? undefined`.
- `hasActiveFilter` includes `userFilters.labelId`.
- `updateUrlFilters`: `if (next.labelId) params.set("label", next.labelId);`
- pass `labels={labels}` to `<TaskFilters>`.
- `buildFullFilters` already forwards `labelId` (it's in `UserFilterParams`), so `fullFilters` picks it up with no change.

Then every page that renders `<TaskView>` (`inbox`, `today`, `upcoming`, `completed`, `projects/[id]`) fetches labels and passes them:
```tsx
import { listLabels } from "@/lib/labels/labels";
// in the Promise.all:
  const [{ data: tasks }, { data: projects }, { data: labels }] = await Promise.all([
    listTasks(supabase, fullFilters),
    listProjects(supabase),
    listLabels(supabase),
  ]);
// on <TaskView>:
    labels={labels ?? []}
```

- [ ] **Step 5: Add chips to `TaskRow`**

`TaskRow` gains an optional prop `labels?: { id: string; name: string; color: string }[]`. Render, before the priority badge:
```tsx
      {labels && labels.length > 0 && (
        <span className="flex shrink-0 gap-1">
          {labels.map((l) => (
            <span key={l.id} className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs"
                  style={{ backgroundColor: `${l.color}20`, color: l.color }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: l.color }} aria-hidden="true" />
              {l.name}
            </span>
          ))}
        </span>
      )}
```
Thread `labelsByTask` from `TaskView` → `TaskList` → `TaskRow`: `TaskView` fetches `task_labels` for the visible tasks once (`supabase.from("task_labels").select("task_id, label_id, labels(name,color)").in("task_id", ids)`), builds a `Map<taskId, chip[]>`, passes `labelsByTask` to `TaskList`, which passes `labels={labelsByTask.get(task.id)}` per row. Keep this in `TaskView`'s `useQuery` alongside the task list (a second query keyed `["task-labels-map", viewKey, ids]`).

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- components/tasks/task-filters.test.tsx components/tasks/task-row.test.tsx`
Expected: PASS (existing `task-row.test.tsx` still green — `labels` is optional).

- [ ] **Step 7: Lint + typecheck + unit suite**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add components/tasks/task-filters.tsx components/tasks/task-filters.test.tsx \
  components/tasks/task-view.tsx components/tasks/task-list.tsx components/tasks/task-row.tsx \
  app/app/inbox/page.tsx app/app/today/page.tsx app/app/upcoming/page.tsx \
  app/app/completed/page.tsx "app/app/projects/[id]/page.tsx"
git commit -m "FLOWDO-4.4: add label filter dropdown and label chips on task rows

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```

---

## Task A7: Wave A checkpoint

**Files:** none (verification only).

- [ ] **Step 1: Full verification suite**

Run: `npx supabase start` then
`npm run lint && npm run typecheck && npm test && npm run test:integration && npm run build`
Expected: all green. If `tests/integration/profile.test.ts` fails alone, re-run `npm run test:integration` (known pre-existing flake per README).

- [ ] **Step 2: Manual smoke test**

Run `npm run dev`, sign in, then: open a task → add 3 subtasks → check 2 → confirm `2 / 3 completed` and the bar; create a "Personal" label via "＋ New label" → assign it → close panel → confirm the chip on the row → filter Inbox by "Personal" → confirm only tagged tasks show → clear the filter.

- [ ] **Step 3: Commit anything uncommitted (e.g. test-fixture tweaks)**

```bash
git add -A && git commit -m "FLOWDO-4.1 FLOWDO-4.2 FLOWDO-4.3 FLOWDO-4.4: Wave A verification pass

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3" --allow-empty
```

---

# WAVE B — Calendar & Recurring Tasks (migration `0007`)

## Task B1: Migration `0007` — recurrence columns

**Files:**
- Create: `supabase/migrations/0007_task_recurrence.sql`, `tests/integration/phase3-migrations.test.ts`
- Modify: `types/database.ts` — the `tasks.recurrence` / `recurrence_rule` fields were added in Task A3; confirm they are present and correct.

**Interfaces:**
- Produces: `flowdo.recurrence_freq` enum; `tasks.recurrence` (`NOT NULL DEFAULT 'NEVER'`), `tasks.recurrence_rule` (`jsonb`, nullable).

- [ ] **Step 1: Write the migration**

`supabase/migrations/0007_task_recurrence.sql`:
```sql
create type flowdo.recurrence_freq as enum
  ('NEVER', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM');

alter table flowdo.tasks
  add column recurrence flowdo.recurrence_freq not null default 'NEVER',
  add column recurrence_rule jsonb;
```

- [ ] **Step 2: Write the failing migration test**

`tests/integration/phase3-migrations.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { queryLocalDb } from "../helpers/pg-client";

describe("phase 3 migrations", () => {
  it("0007: tasks.recurrence column + enum", async () => {
    const col = await queryLocalDb(
      `select column_default, is_nullable from information_schema.columns
       where table_schema='flowdo' and table_name='tasks' and column_name='recurrence'`
    );
    expect(col.rows.length).toBe(1);
    expect(col.rows[0].column_default).toContain("NEVER");
    expect(col.rows[0].is_nullable).toBe("NO");

    const vals = await queryLocalDb(
      `select enumlabel from pg_enum e join pg_type t on t.oid=e.enumtypid
       where t.typname='recurrence_freq' order by enumsortorder`
    );
    expect(vals.rows.map((r) => r.enumlabel)).toEqual(
      ["NEVER", "DAILY", "WEEKLY", "MONTHLY", "YEARLY", "CUSTOM"]
    );
  });

  it("0007: tasks.recurrence_rule is nullable jsonb", async () => {
    const col = await queryLocalDb(
      `select data_type, is_nullable from information_schema.columns
       where table_schema='flowdo' and table_name='tasks' and column_name='recurrence_rule'`
    );
    expect(col.rows[0]).toMatchObject({ data_type: "jsonb", is_nullable: "YES" });
  });
});
```

- [ ] **Step 3: Apply migrations and run the test**

Run: `npx supabase db reset` then `npm run test:integration -- tests/integration/phase3-migrations.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 4: Typecheck (types were added in A3)**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0007_task_recurrence.sql tests/integration/phase3-migrations.test.ts
git commit -m "FLOWDO-4.8: add task recurrence columns (migration 0007)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```

---

## Task B2: `nextDueDate` pure function

**Files:**
- Create: `lib/tasks/recurrence.ts`, `lib/tasks/recurrence.test.ts`

**Interfaces:**
- Produces: `Recurrence`, `RecurrenceRule`, `nextDueDate(current, recurrence, rule)` (signatures above).

- [ ] **Step 1: Write the failing tests**

`lib/tasks/recurrence.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { nextDueDate } from "./recurrence";

const iso = (d: Date) => d.toISOString();

describe("nextDueDate", () => {
  it("DAILY adds one day", () => {
    expect(iso(nextDueDate(new Date("2026-03-15T09:00:00.000Z"), "DAILY", null)))
      .toBe("2026-03-16T09:00:00.000Z");
  });

  it("WEEKLY adds seven days", () => {
    expect(iso(nextDueDate(new Date("2026-03-15T09:00:00.000Z"), "WEEKLY", null)))
      .toBe("2026-03-22T09:00:00.000Z");
  });

  it("MONTHLY adds one calendar month", () => {
    expect(iso(nextDueDate(new Date("2026-03-15T09:00:00.000Z"), "MONTHLY", null)))
      .toBe("2026-04-15T09:00:00.000Z");
  });

  it("MONTHLY clamps to the last day when the target month is shorter", () => {
    expect(iso(nextDueDate(new Date("2026-01-31T09:00:00.000Z"), "MONTHLY", null)))
      .toBe("2026-02-28T09:00:00.000Z");
  });

  it("MONTHLY clamps to Feb 29 in a leap year", () => {
    expect(iso(nextDueDate(new Date("2028-01-31T09:00:00.000Z"), "MONTHLY", null)))
      .toBe("2028-02-29T09:00:00.000Z");
  });

  it("YEARLY adds one year and clamps Feb 29 → Feb 28", () => {
    expect(iso(nextDueDate(new Date("2028-02-29T09:00:00.000Z"), "YEARLY", null)))
      .toBe("2029-02-28T09:00:00.000Z");
  });

  it("CUSTOM every 3 days", () => {
    expect(iso(nextDueDate(new Date("2026-03-15T09:00:00.000Z"), "CUSTOM", { interval: 3, unit: "day" })))
      .toBe("2026-03-18T09:00:00.000Z");
  });

  it("CUSTOM every 2 months clamps", () => {
    expect(iso(nextDueDate(new Date("2026-01-31T09:00:00.000Z"), "CUSTOM", { interval: 2, unit: "month" })))
      .toBe("2026-03-31T09:00:00.000Z");
  });

  it("does not mutate the input date", () => {
    const d = new Date("2026-03-15T09:00:00.000Z");
    nextDueDate(d, "DAILY", null);
    expect(iso(d)).toBe("2026-03-15T09:00:00.000Z");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- lib/tasks/recurrence.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/tasks/recurrence.ts`**

```ts
export type Recurrence = "NEVER" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | "CUSTOM";
export type RecurrenceRule = { interval: number; unit: "day" | "week" | "month" | "year" };

function daysInMonth(year: number, monthIndex: number): number {
  // monthIndex may be out of 0-11 range; Date normalises it. Day 0 of month M+1 = last day of month M.
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function addDays(current: Date, n: number): Date {
  return new Date(current.getTime() + n * 24 * 60 * 60 * 1000);
}

function addMonths(current: Date, n: number): Date {
  const y = current.getUTCFullYear();
  const m = current.getUTCMonth();
  const day = current.getUTCDate();
  const targetMonthDays = daysInMonth(y, m + n);
  return new Date(
    Date.UTC(
      y,
      m + n,
      Math.min(day, targetMonthDays),
      current.getUTCHours(),
      current.getUTCMinutes(),
      current.getUTCSeconds(),
      current.getUTCMilliseconds()
    )
  );
}

export function nextDueDate(
  current: Date,
  recurrence: Exclude<Recurrence, "NEVER">,
  rule: RecurrenceRule | null
): Date {
  switch (recurrence) {
    case "DAILY":
      return addDays(current, 1);
    case "WEEKLY":
      return addDays(current, 7);
    case "MONTHLY":
      return addMonths(current, 1);
    case "YEARLY":
      return addMonths(current, 12);
    case "CUSTOM": {
      if (!rule || rule.interval < 1) return addDays(current, 1);
      switch (rule.unit) {
        case "day":
          return addDays(current, rule.interval);
        case "week":
          return addDays(current, rule.interval * 7);
        case "month":
          return addMonths(current, rule.interval);
        case "year":
          return addMonths(current, rule.interval * 12);
      }
    }
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- lib/tasks/recurrence.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Lint + typecheck**

Run: `npm run lint && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/tasks/recurrence.ts lib/tasks/recurrence.test.ts
git commit -m "FLOWDO-4.8: add nextDueDate recurrence date math

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```

---

## Task B3: `completeTask` generates the next occurrence + `taskSchema` recurrence fields

**Files:**
- Modify: `lib/tasks/tasks.ts` (`createTask`/`updateTask` accept `recurrence`/`recurrenceRule`; `completeTask` returns the row and generates the next occurrence), `lib/validations/tasks.ts` (+ recurrence), `lib/validations/tasks.test.ts`
- Test: `tests/integration/recurrence.test.ts`

**Interfaces:**
- Consumes: `nextDueDate` (B2).
- Produces: `completeTask` still returns `{ error }` (unchanged signature — the new task creation is a side effect); `TaskInputLike` gains `recurrence?: Recurrence`, `recurrenceRule?: RecurrenceRule | null`, `parentTaskId?: string | null`.

- [ ] **Step 1: Write the failing schema test**

Add to `lib/validations/tasks.test.ts`:
```ts
  it("taskSchema accepts a recurrence with no rule for presets", () => {
    const r = taskSchema.parse({ title: "x", recurrence: "WEEKLY" });
    expect(r.recurrence).toBe("WEEKLY");
  });
  it("taskSchema requires a rule when recurrence is CUSTOM", () => {
    expect(taskSchema.safeParse({ title: "x", recurrence: "CUSTOM" }).success).toBe(false);
    expect(
      taskSchema.safeParse({ title: "x", recurrence: "CUSTOM", recurrenceRule: { interval: 2, unit: "week" } }).success
    ).toBe(true);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- lib/validations/tasks.test.ts`
Expected: FAIL — `recurrence` stripped / no refine.

- [ ] **Step 3: Extend `taskSchema`**

`lib/validations/tasks.ts`:
```ts
export const recurrenceRuleSchema = z.object({
  interval: z.number().int().positive(),
  unit: z.enum(["day", "week", "month", "year"]),
});

export const taskSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required"),
    description: z.string().trim().optional(),
    dueDate: z.string().optional().nullable(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    projectId: z.string().uuid().optional().nullable(),
    recurrence: z.enum(["NEVER", "DAILY", "WEEKLY", "MONTHLY", "YEARLY", "CUSTOM"]).optional(),
    recurrenceRule: recurrenceRuleSchema.optional().nullable(),
  })
  .superRefine((val, ctx) => {
    if (val.recurrence === "CUSTOM" && !val.recurrenceRule) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["recurrenceRule"], message: "Set a repeat interval" });
    }
    if (val.recurrence && val.recurrence !== "NEVER" && !val.dueDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["recurrence"], message: "Add a due date to repeat this task" });
    }
  });
export type TaskInput = z.infer<typeof taskSchema>;
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- lib/validations/tasks.test.ts`
Expected: PASS.

- [ ] **Step 5: Extend `lib/tasks/tasks.ts`**

- Import: `import { nextDueDate, type Recurrence, type RecurrenceRule } from "./recurrence";`
- `TaskInputLike`:
```ts
export interface TaskInputLike {
  title: string;
  description?: string;
  dueDate?: string | null;
  priority?: TaskPriority;
  projectId?: string | null;
  parentTaskId?: string | null;
  recurrence?: Recurrence;
  recurrenceRule?: RecurrenceRule | null;
}
```
- `createTask` insert object gains:
```ts
      parent_task_id: input.parentTaskId ?? null,
      recurrence: input.recurrence ?? "NEVER",
      recurrence_rule: input.recurrenceRule ?? null,
```
- `updateTask` patch:
```ts
  if (input.recurrence !== undefined) patch.recurrence = input.recurrence;
  if (input.recurrenceRule !== undefined) patch.recurrence_rule = input.recurrenceRule;
```
- `completeTask` — replace the body with:
```ts
export async function completeTask(supabase: Client, taskId: string) {
  const { data: task, error } = await supabase
    .from("tasks")
    .update({ status: "COMPLETED", completed_at: new Date().toISOString() })
    .eq("id", taskId)
    .select()
    .single();
  if (error || !task) return { error: "Couldn't complete task. Please try again." };

  if (task.recurrence !== "NEVER" && task.due_date) {
    const next = nextDueDate(new Date(task.due_date), task.recurrence, task.recurrence_rule);
    const { error: cloneError } = await supabase.from("tasks").insert({
      user_id: task.user_id,
      project_id: task.project_id,
      parent_task_id: task.parent_task_id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      due_date: next.toISOString(),
      recurrence: task.recurrence,
      recurrence_rule: task.recurrence_rule,
      position: Date.now(),
    });
    // The task IS completed; a failed clone is surfaced but not rolled back.
    if (cloneError) return { error: "Task completed, but the next occurrence couldn't be created." };
  }
  return { error: null };
}
```

- [ ] **Step 6: Write the integration test**

`tests/integration/recurrence.test.ts`:
```ts
import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient } from "../helpers/admin-client";
import { createConfirmedTestUser } from "../helpers/test-user";
import { createTask, completeTask, listTasks } from "@/lib/tasks/tasks";

const admin = createAdminClient();
const createdUserIds: string[] = [];
afterEach(async () => {
  for (const id of createdUserIds.splice(0)) await admin.auth.admin.deleteUser(id);
});

describe("recurring tasks", () => {
  it("completing a WEEKLY task creates the next occurrence 7 days later", async () => {
    const owner = await createConfirmedTestUser(admin, "recur-weekly@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const due = "2026-03-15T09:00:00.000Z";
    const { data: task } = await createTask(owner.client, owner.userId, {
      title: "Water plants", dueDate: due, recurrence: "WEEKLY",
    });
    await completeTask(owner.client, task!.id);

    const { data: open } = await listTasks(owner.client, { excludeCompleted: true });
    const next = open?.find((t) => t.title === "Water plants");
    expect(next).toBeTruthy();
    expect(next!.due_date).toBe("2026-03-22T09:00:00.000Z");
    expect(next!.recurrence).toBe("WEEKLY");
    expect(next!.id).not.toBe(task!.id);
  });

  it("a recurring task with no due date creates no occurrence", async () => {
    const owner = await createConfirmedTestUser(admin, "recur-nodue@example.com", "Password123!");
    createdUserIds.push(owner.userId);
    const { data: task } = await createTask(owner.client, owner.userId, { title: "Someday", recurrence: "DAILY" });
    await completeTask(owner.client, task!.id);
    const { data: open } = await listTasks(owner.client, { excludeCompleted: true });
    expect(open?.find((t) => t.title === "Someday")).toBeUndefined();
  });

  it("a NEVER task creates no occurrence", async () => {
    const owner = await createConfirmedTestUser(admin, "recur-never@example.com", "Password123!");
    createdUserIds.push(owner.userId);
    const { data: task } = await createTask(owner.client, owner.userId, {
      title: "One off", dueDate: "2026-03-15T09:00:00.000Z",
    });
    await completeTask(owner.client, task!.id);
    const { data: open } = await listTasks(owner.client, { excludeCompleted: true });
    expect(open?.find((t) => t.title === "One off")).toBeUndefined();
  });
});
```

- [ ] **Step 7: Run integration + unit + lint + typecheck**

Run: `npm run test:integration -- tests/integration/recurrence.test.ts && npm run lint && npm run typecheck && npm test`
Expected: all PASS. (Existing `tests/integration/tasks.test.ts` `completeTask` test still passes — the signature is unchanged.)

- [ ] **Step 8: Commit**

```bash
git add lib/tasks/tasks.ts lib/validations/tasks.ts lib/validations/tasks.test.ts tests/integration/recurrence.test.ts
git commit -m "FLOWDO-4.9: generate the next occurrence when a recurring task is completed

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```

---

## Task B4: Recurrence field in the detail panel + repeat icon on rows

**Files:**
- Create: `components/tasks/recurrence-field.tsx`, `components/tasks/recurrence-field.test.tsx`
- Modify: `components/tasks/task-detail-panel.tsx` (mount it, feed `recurrence`/`recurrenceRule` through the form), `components/tasks/task-row.tsx` (repeat icon)

**Interfaces:**
- Consumes: `taskSchema` recurrence fields (B3).
- Produces: `<RecurrenceField value onChange hasDueDate />` where `value: { recurrence: Recurrence; rule: RecurrenceRule | null }`.

- [ ] **Step 1: Write the failing component test**

`components/tasks/recurrence-field.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecurrenceField } from "./recurrence-field";

describe("RecurrenceField", () => {
  it("is disabled with a hint when there is no due date", () => {
    render(<RecurrenceField value={{ recurrence: "NEVER", rule: null }} onChange={() => {}} hasDueDate={false} />);
    expect(screen.getByLabelText("Repeat")).toBeDisabled();
    expect(screen.getByText(/add a due date/i)).toBeInTheDocument();
  });

  it("reveals interval inputs when Custom is chosen", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RecurrenceField value={{ recurrence: "NEVER", rule: null }} onChange={onChange} hasDueDate />);
    await user.selectOptions(screen.getByLabelText("Repeat"), "CUSTOM");
    expect(onChange).toHaveBeenCalledWith({ recurrence: "CUSTOM", rule: { interval: 1, unit: "week" } });
  });

  it("emits a preset with a null rule", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RecurrenceField value={{ recurrence: "NEVER", rule: null }} onChange={onChange} hasDueDate />);
    await user.selectOptions(screen.getByLabelText("Repeat"), "MONTHLY");
    expect(onChange).toHaveBeenCalledWith({ recurrence: "MONTHLY", rule: null });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- components/tasks/recurrence-field.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `components/tasks/recurrence-field.tsx`**

```tsx
"use client";
import type { Recurrence, RecurrenceRule } from "@/lib/tasks/recurrence";

const PRESETS: Recurrence[] = ["NEVER", "DAILY", "WEEKLY", "MONTHLY", "YEARLY", "CUSTOM"];
const LABEL: Record<Recurrence, string> = {
  NEVER: "Doesn't repeat", DAILY: "Daily", WEEKLY: "Weekly",
  MONTHLY: "Monthly", YEARLY: "Yearly", CUSTOM: "Custom…",
};

export function RecurrenceField({
  value,
  onChange,
  hasDueDate,
}: {
  value: { recurrence: Recurrence; rule: RecurrenceRule | null };
  onChange: (next: { recurrence: Recurrence; rule: RecurrenceRule | null }) => void;
  hasDueDate: boolean;
}) {
  function pick(recurrence: Recurrence) {
    if (recurrence === "CUSTOM") {
      onChange({ recurrence, rule: value.rule ?? { interval: 1, unit: "week" } });
    } else {
      onChange({ recurrence, rule: null });
    }
  }

  return (
    <div className="space-y-2">
      <label htmlFor="recurrence" className="text-sm font-medium">Repeat</label>
      <select
        id="recurrence"
        aria-label="Repeat"
        value={value.recurrence}
        disabled={!hasDueDate}
        onChange={(e) => pick(e.target.value as Recurrence)}
        className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
      >
        {PRESETS.map((p) => <option key={p} value={p}>{LABEL[p]}</option>)}
      </select>

      {!hasDueDate && <p className="text-xs text-muted-foreground">Add a due date to repeat this task.</p>}

      {hasDueDate && value.recurrence === "CUSTOM" && value.rule && (
        <div className="flex items-center gap-2 text-sm">
          <span>every</span>
          <input
            type="number"
            min={1}
            aria-label="Interval"
            value={value.rule.interval}
            onChange={(e) => onChange({ recurrence: "CUSTOM", rule: { ...value.rule!, interval: Math.max(1, Number(e.target.value) || 1) } })}
            className="h-9 w-16 rounded-md border border-border bg-background px-2"
          />
          <select
            aria-label="Interval unit"
            value={value.rule.unit}
            onChange={(e) => onChange({ recurrence: "CUSTOM", rule: { ...value.rule!, unit: e.target.value as RecurrenceRule["unit"] } })}
            className="h-9 rounded-md border border-border bg-background px-2"
          >
            <option value="day">days</option>
            <option value="week">weeks</option>
            <option value="month">months</option>
            <option value="year">years</option>
          </select>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- components/tasks/recurrence-field.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire into the detail panel**

In `components/tasks/task-detail-panel.tsx`:
- The form uses `useForm<TaskInput>` with `values`. Add `recurrence: task.recurrence` and `recurrenceRule: task.recurrence_rule` to the `values` object.
- Add local mirror state so `RecurrenceField` (not a native input) can drive the form:
```tsx
  const [recurrence, setRecurrence] = React.useState<{ recurrence: Recurrence; rule: RecurrenceRule | null }>({
    recurrence: task.recurrence,
    rule: task.recurrence_rule,
  });
  const dueDateValue = watch("dueDate"); // add `watch` to the useForm destructure
```
- Render `<RecurrenceField value={recurrence} onChange={setRecurrence} hasDueDate={!!dueDateValue} />` below the Labels field.
- In `onSubmit`, merge: `await onSave(task.id, { ...values, recurrence: recurrence.recurrence, recurrenceRule: recurrence.rule });`

`updateTask` already handles `recurrence` / `recurrenceRule` from B3.

- [ ] **Step 6: Repeat icon on `TaskRow`**

In `components/tasks/task-row.tsx`, import `Repeat` from `lucide-react`; after the due-date span:
```tsx
      {task.recurrence !== "NEVER" && (
        <Repeat className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Repeats" />
      )}
```

- [ ] **Step 7: Lint + typecheck + unit suite**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all PASS (update `task-detail-panel.test.tsx` fixture `task` to include `recurrence: "NEVER"`, `recurrence_rule: null` if flagged).

- [ ] **Step 8: Commit**

```bash
git add components/tasks/recurrence-field.tsx components/tasks/recurrence-field.test.tsx \
  components/tasks/task-detail-panel.tsx components/tasks/task-row.tsx components/tasks/task-detail-panel.test.tsx
git commit -m "FLOWDO-4.8: add recurrence field to task detail and repeat icon to rows

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```

---

## Task B5: `buildMonthGrid` + `monthRange` pure functions

**Files:**
- Create: `lib/calendar/month.ts`, `lib/calendar/month.test.ts`

**Interfaces:**
- Produces: `DayCell`, `buildMonthGrid(year, month)`, `monthRange(year, month)` (signatures above). `month` is 1–12.

- [ ] **Step 1: Write the failing tests**

`lib/calendar/month.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildMonthGrid, monthRange } from "./month";

describe("buildMonthGrid", () => {
  it("March 2026 starts on Sunday and spans 6 weeks", () => {
    const grid = buildMonthGrid(2026, 3);
    expect(grid.length).toBe(6);
    expect(grid[0].length).toBe(7);
    // Monday-first: 2026-03-01 is a Sunday, so it's the last cell of week 0
    expect(grid[0][6]).toEqual({ date: "2026-03-01", inMonth: true });
    expect(grid[0][0]).toEqual({ date: "2026-02-23", inMonth: false });
  });

  it("February 2026 (28 days, starts Sunday) spans 5 weeks", () => {
    const grid = buildMonthGrid(2026, 2);
    expect(grid.length).toBe(5);
    expect(grid[0][6]).toEqual({ date: "2026-02-01", inMonth: true });
    expect(grid[4][5]).toEqual({ date: "2026-02-28", inMonth: true });
  });

  it("February 2028 is a leap month with 29 days", () => {
    const grid = buildMonthGrid(2028, 2);
    const flat = grid.flat();
    expect(flat.some((c) => c.date === "2028-02-29" && c.inMonth)).toBe(true);
  });

  it("every week has exactly 7 cells and the whole grid is contiguous", () => {
    const flat = buildMonthGrid(2026, 11).flat();
    for (let i = 1; i < flat.length; i++) {
      const prev = new Date(flat[i - 1].date + "T00:00:00Z").getTime();
      const cur = new Date(flat[i].date + "T00:00:00Z").getTime();
      expect(cur - prev).toBe(86400000);
    }
  });
});

describe("monthRange", () => {
  it("covers the padded grid as [start, end) instants", () => {
    const { start, end } = monthRange(2026, 3);
    expect(start).toBe("2026-02-23T00:00:00.000Z");
    expect(end).toBe("2026-04-06T00:00:00.000Z"); // day after the last grid cell
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- lib/calendar/month.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/calendar/month.ts`**

```ts
export type DayCell = { date: string; inMonth: boolean };

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Monday-first index: Mon=0 … Sun=6
function mondayIndex(d: Date): number {
  return (d.getUTCDay() + 6) % 7;
}

export function buildMonthGrid(year: number, month: number): DayCell[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const gridStart = new Date(first);
  gridStart.setUTCDate(first.getUTCDate() - mondayIndex(first));

  const lastOfMonth = new Date(Date.UTC(year, month, 0));
  const gridEnd = new Date(lastOfMonth);
  gridEnd.setUTCDate(lastOfMonth.getUTCDate() + (6 - mondayIndex(lastOfMonth)));

  const weeks: DayCell[][] = [];
  const cursor = new Date(gridStart);
  while (cursor.getTime() <= gridEnd.getTime()) {
    const week: DayCell[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({ date: ymd(cursor), inMonth: cursor.getUTCMonth() === month - 1 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export function monthRange(year: number, month: number): { start: string; end: string } {
  const grid = buildMonthGrid(year, month);
  const firstDate = grid[0][0].date;
  const lastDate = grid[grid.length - 1][6].date;
  const end = new Date(lastDate + "T00:00:00.000Z");
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: `${firstDate}T00:00:00.000Z`, end: end.toISOString() };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- lib/calendar/month.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint + typecheck**

Run: `npm run lint && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/calendar/month.ts lib/calendar/month.test.ts
git commit -m "FLOWDO-4.5: add month-grid date math for the calendar view

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```

---

## Task B6: `dueDateRange` filter + calendar Server Component

**Files:**
- Modify: `lib/tasks/tasks.ts` (`dueDateRange` filter), `app/app/calendar/page.tsx` (replace stub)
- Test: `tests/integration/calendar.test.ts`

**Interfaces:**
- Consumes: `monthRange` (B5), `listTasks` (A1).
- Produces: `ListTasksFilters.dueDateRange`; the calendar page passes `{ year, month, tasks, projects, labels }` to `<MonthGrid>` (Task B7).

- [ ] **Step 1: Add `dueDateRange` to `listTasks`**

In `lib/tasks/tasks.ts`, `ListTasksFilters` gains `dueDateRange?: { start: string; end: string };`. In `listTasks`, inside the due-date branching, add a case (before or after the `dueDate` string cases — they are mutually exclusive in practice):
```ts
  if (filters.dueDateRange) {
    query = query.gte("due_date", filters.dueDateRange.start).lt("due_date", filters.dueDateRange.end);
  }
```

- [ ] **Step 2: Write the failing integration test**

`tests/integration/calendar.test.ts`:
```ts
import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient } from "../helpers/admin-client";
import { createConfirmedTestUser } from "../helpers/test-user";
import { createTask, listTasks } from "@/lib/tasks/tasks";
import { monthRange } from "@/lib/calendar/month";

const admin = createAdminClient();
const createdUserIds: string[] = [];
afterEach(async () => {
  for (const id of createdUserIds.splice(0)) await admin.auth.admin.deleteUser(id);
});

describe("calendar dueDateRange filter", () => {
  it("returns only tasks whose due_date is inside the padded month grid", async () => {
    const owner = await createConfirmedTestUser(admin, "calendar-range@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    await createTask(owner.client, owner.userId, { title: "In March", dueDate: "2026-03-10T09:00:00.000Z" });
    await createTask(owner.client, owner.userId, { title: "In June", dueDate: "2026-06-10T09:00:00.000Z" });
    await createTask(owner.client, owner.userId, { title: "No due date" });

    const { data } = await listTasks(owner.client, { dueDateRange: monthRange(2026, 3), parentTaskId: null });
    expect(data?.map((t) => t.title)).toEqual(["In March"]);
  });
});
```

- [ ] **Step 3: Run it**

Run: `npm run test:integration -- tests/integration/calendar.test.ts`
Expected: PASS.

- [ ] **Step 4: Replace `app/app/calendar/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import { listTasks } from "@/lib/tasks/tasks";
import { listProjects } from "@/lib/projects/projects";
import { listLabels } from "@/lib/labels/labels";
import { monthRange } from "@/lib/calendar/month";
import { MonthGrid } from "@/components/calendar/month-grid";

function parseMonth(param: string | undefined): { year: number; month: number } {
  const now = new Date();
  const m = /^(\d{4})-(\d{2})$/.exec(param ?? "");
  if (!m) return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  return { year: Number(m[1]), month: Number(m[2]) };
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { year, month } = parseMonth(searchParams.month);
  const [{ data: tasks }, { data: projects }, { data: labels }] = await Promise.all([
    listTasks(supabase, { dueDateRange: monthRange(year, month), parentTaskId: null }),
    listProjects(supabase),
    listLabels(supabase),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Calendar</h1>
      <MonthGrid
        year={year}
        month={month}
        tasks={tasks ?? []}
        projects={projects ?? []}
        labels={labels ?? []}
        userId={user!.id}
      />
    </div>
  );
}
```

- [ ] **Step 5: Lint + typecheck + unit + build (build will fail on the missing `MonthGrid` — expected until B7)**

Run: `npm run lint && npm run typecheck`
Expected: FAIL on missing `@/components/calendar/month-grid`. That is fine — B7 creates it. Do **not** commit a broken build; instead, do steps 4–5 of B7 first if executing strictly, or land B6+B7 in one commit. **Recommended:** merge this task's commit with B7 (see B7 step 8).

- [ ] **Step 6: Commit the filter + test only (page waits for B7)**

```bash
git add lib/tasks/tasks.ts tests/integration/calendar.test.ts
git commit -m "FLOWDO-4.5: add dueDateRange filter to listTasks

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```
Leave `app/app/calendar/page.tsx` edited but uncommitted; B7 commits it with the component.

---

## Task B7: `MonthGrid` + create-from-day + open-detail

**Files:**
- Create: `components/calendar/month-grid.tsx`, `components/calendar/month-grid.test.tsx`, `components/calendar/create-task-dialog.tsx`
- Modify: `app/app/calendar/page.tsx` (commit the B6 edit)

**Interfaces:**
- Consumes: `buildMonthGrid` (B5), `createTask` (A1/B3), `TaskDetailPanel` (existing), `listTasks`/`setTaskLabels` for the panel's save path.
- Produces: `<MonthGrid year month tasks projects labels userId />`.

- [ ] **Step 1: Write the failing component test**

`components/calendar/month-grid.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MonthGrid } from "./month-grid";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const task = (over: Partial<Record<string, unknown>>) => ({
  id: "t1", user_id: "u1", project_id: null, parent_task_id: null, title: "Demo",
  description: null, status: "TODO", priority: "MEDIUM", due_date: "2026-03-10T09:00:00.000Z",
  completed_at: null, position: 0, created_at: "", updated_at: "", recurrence: "NEVER", recurrence_rule: null,
  ...over,
});

beforeEach(() => vi.clearAllMocks());

describe("MonthGrid", () => {
  it("renders 6 weeks for March 2026 and places a task on the 10th", () => {
    wrap(<MonthGrid year={2026} month={3} tasks={[task({}) as never]} projects={[]} labels={[]} userId="u1" />);
    expect(screen.getAllByRole("row")).toHaveLength(6);
    expect(screen.getByText("Demo")).toBeInTheDocument();
  });

  it("prev/next links navigate by month", async () => {
    wrap(<MonthGrid year={2026} month={3} tasks={[]} projects={[]} labels={[]} userId="u1" />);
    screen.getByRole("link", { name: /previous month/i }).click();
    expect(push).toHaveBeenCalledWith("?month=2026-02");
    screen.getByRole("link", { name: /next month/i }).click();
    expect(push).toHaveBeenCalledWith("?month=2026-04");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- components/calendar/month-grid.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `components/calendar/create-task-dialog.tsx`**

```tsx
"use client";
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createTask } from "@/lib/tasks/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateTaskDialog({
  date,
  userId,
  onOpenChange,
}: {
  date: string; // "YYYY-MM-DD"
  userId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const supabase = createClient();
  const qc = useQueryClient();
  const [title, setTitle] = React.useState("");
  const create = useMutation({
    mutationFn: () => createTask(supabase, userId, { title: title.trim(), dueDate: `${date}T09:00:00.000Z` }),
    onSuccess: (r) => {
      if (!r.error) {
        qc.invalidateQueries({ queryKey: ["tasks"] });
        onOpenChange(false);
      }
    },
  });

  return (
    <Dialog.Root open onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-lg bg-background p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">New task on {date}</Dialog.Title>
            <Dialog.Close aria-label="Close"><X className="h-5 w-5" /></Dialog.Close>
          </div>
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
                 onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) create.mutate(); }}
                 placeholder="Task title" />
          <div className="flex justify-end">
            <Button type="button" disabled={!title.trim()} onClick={() => create.mutate()}>Add task</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 4: Implement `components/calendar/month-grid.tsx`**

```tsx
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { buildMonthGrid } from "@/lib/calendar/month";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import { CreateTaskDialog } from "./create-task-dialog";
import { createClient } from "@/lib/supabase/client";
import { updateTask } from "@/lib/tasks/tasks";
import { setTaskLabels } from "@/lib/tasks/task-labels";
import type { Database } from "@/types/database";

type TaskRow = Database["flowdo"]["Tables"]["tasks"]["Row"];
type ProjectRow = Database["flowdo"]["Tables"]["projects"]["Row"];
type LabelRow = Database["flowdo"]["Tables"]["labels"]["Row"];

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function shift(year: number, month: number, delta: number): string {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function MonthGrid({
  year, month, tasks, projects, labels, userId,
}: {
  year: number; month: number;
  tasks: TaskRow[]; projects: ProjectRow[]; labels: LabelRow[]; userId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const weeks = buildMonthGrid(year, month);
  const [openTask, setOpenTask] = React.useState<TaskRow | null>(null);
  const [createOn, setCreateOn] = React.useState<string | null>(null);

  const byDay = new Map<string, TaskRow[]>();
  for (const t of tasks) {
    if (!t.due_date) continue;
    const key = t.due_date.slice(0, 10);
    (byDay.get(key) ?? byDay.set(key, []).get(key)!).push(t);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">{MONTHS[month - 1]} {year}</h2>
        <div className="flex gap-1">
          <a aria-label="Previous month" href={`?month=${shift(year, month, -1)}`}
             onClick={(e) => { e.preventDefault(); router.push(`?month=${shift(year, month, -1)}`); }}
             className="rounded-md border border-border p-1"><ChevronLeft className="h-4 w-4" /></a>
          <a aria-label="Next month" href={`?month=${shift(year, month, 1)}`}
             onClick={(e) => { e.preventDefault(); router.push(`?month=${shift(year, month, 1)}`); }}
             className="rounded-md border border-border p-1"><ChevronRight className="h-4 w-4" /></a>
        </div>
      </div>

      <div className="hidden grid-cols-7 gap-px text-xs text-muted-foreground md:grid">
        {WEEKDAYS.map((d) => <div key={d} className="px-2 py-1">{d}</div>)}
      </div>

      <div role="grid" className="grid grid-cols-1 gap-px md:grid-cols-7">
        {weeks.map((week, wi) => (
          <React.Fragment key={wi}>
            <div role="row" className="contents">
              {week.map((cell) => {
                const dayTasks = byDay.get(cell.date) ?? [];
                if (!cell.inMonth && dayTasks.length === 0) {
                  return <div key={cell.date} role="gridcell" className="hidden min-h-24 border border-border bg-muted/30 md:block" />;
                }
                return (
                  <div key={cell.date} role="gridcell"
                       className={"group min-h-24 border border-border p-1 " + (cell.inMonth ? "" : "bg-muted/30")}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{Number(cell.date.slice(8, 10))}</span>
                      <button type="button" aria-label={`Add task on ${cell.date}`}
                              onClick={() => setCreateOn(cell.date)}
                              className="opacity-0 focus:opacity-100 group-hover:opacity-100">
                        <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                    <ul className="space-y-0.5">
                      {dayTasks.slice(0, 3).map((t) => (
                        <li key={t.id}>
                          <button type="button" onClick={() => setOpenTask(t)}
                                  className="flex w-full items-center gap-1 truncate rounded px-1 text-left text-xs hover:bg-muted">
                            <span className={"h-1.5 w-1.5 shrink-0 rounded-full " +
                              (t.priority === "URGENT" ? "bg-destructive" : t.priority === "HIGH" ? "bg-orange-500" : "bg-muted-foreground")} />
                            <span className="truncate">{t.title}</span>
                          </button>
                        </li>
                      ))}
                      {dayTasks.length > 3 && (
                        <li className="px-1 text-xs text-muted-foreground">+{dayTasks.length - 3} more</li>
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
          </React.Fragment>
        ))}
      </div>

      {openTask && (
        <TaskDetailPanel
          task={openTask}
          projects={projects}
          userId={userId}
          open={!!openTask}
          onOpenChange={(o) => !o && setOpenTask(null)}
          onSave={async (taskId, input) => { await updateTask(supabase, taskId, input); router.refresh(); }}
          onLabelsChange={async (taskId, ids) => { await setTaskLabels(supabase, taskId, ids); }}
          onDelete={async () => { setOpenTask(null); router.refresh(); }}
        />
      )}
      {createOn && <CreateTaskDialog date={createOn} userId={userId} onOpenChange={() => { setCreateOn(null); router.refresh(); }} />}
    </div>
  );
}
```
(If `TaskDetailPanel`'s prop names differ after Wave A edits, match them. The `role="row"` wrapper with `className="contents"` is what the test counts — keep it.)

- [ ] **Step 5: Run the component test**

Run: `npm test -- components/calendar/month-grid.test.tsx`
Expected: PASS (2 tests). Adjust the `getAllByRole("row")` expectation if the grid renders a header row — the test expects exactly the 6 week rows.

- [ ] **Step 6: Full lint + typecheck + unit + build**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: all PASS — `app/app/calendar/page.tsx` (edited in B6) now compiles.

- [ ] **Step 7: Manual check**

`npm run dev` → Calendar → confirm the month renders, prev/next work, "+" on a day opens the dialog and creates a task that appears on that day, clicking a task opens the detail panel.

- [ ] **Step 8: Commit (includes the B6 page edit)**

```bash
git add components/calendar/ app/app/calendar/page.tsx
git commit -m "FLOWDO-4.6 FLOWDO-4.7: calendar month view with create-from-day and task detail

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```

---

## Task B8: Wave B checkpoint

**Files:** none.

- [ ] **Step 1: Full verification**

Run: `npx supabase db reset` then
`npm run lint && npm run typecheck && npm test && npm run test:integration && npm run build`
Expected: all green.

- [ ] **Step 2: Manual smoke test**

Set a task to Weekly with a due date → complete it → confirm a new occurrence 7 days out and the original in Completed → open Calendar, page months, create a task on a day, open it.

- [ ] **Step 3: Commit any fixups**

```bash
git add -A && git commit -m "FLOWDO-4.5 FLOWDO-4.6 FLOWDO-4.7 FLOWDO-4.8 FLOWDO-4.9: Wave B verification pass

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3" --allow-empty
```

---

# WAVE C — Activity Log & Notifications (migrations `0008`, `0009`)

## Task C1: Migration `0008` — activity triggers

**Files:**
- Create: `supabase/migrations/0008_activity_log_triggers.sql`
- Modify: `tests/integration/phase3-migrations.test.ts` (add trigger-existence checks)

**Interfaces:**
- Produces: `flowdo.log_task_activity()`, `flowdo.log_project_activity()` + `after insert or update or delete` triggers on `tasks` and `projects`. Rows land in `flowdo.activity_logs` (types added in A3).

- [ ] **Step 1: Write the migration**

`supabase/migrations/0008_activity_log_triggers.sql`:
```sql
create or replace function flowdo.log_task_activity()
returns trigger
language plpgsql
security definer
set search_path = flowdo, public
as $$
declare
  v_action text;
  v_user   uuid := coalesce(new.user_id, old.user_id);
begin
  if (tg_op = 'INSERT') then
    v_action := 'task.created';
  elsif (tg_op = 'DELETE') then
    v_action := 'task.deleted';
  elsif (new.status = 'COMPLETED' and old.status is distinct from 'COMPLETED') then
    v_action := 'task.completed';
  elsif (old.status = 'COMPLETED' and new.status is distinct from 'COMPLETED') then
    v_action := 'task.reopened';
  else
    v_action := 'task.updated';
  end if;

  insert into flowdo.activity_logs (user_id, task_id, project_id, action, metadata)
  values (
    v_user,
    case when tg_op = 'DELETE' then null else new.id end,
    case when tg_op = 'DELETE' then null else new.project_id end,
    v_action,
    case
      when tg_op = 'DELETE' then jsonb_build_object('task_id', old.id, 'title', old.title)
      else jsonb_build_object('title', new.title)
    end
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger log_task_activity
  after insert or update or delete on flowdo.tasks
  for each row execute function flowdo.log_task_activity();

create or replace function flowdo.log_project_activity()
returns trigger
language plpgsql
security definer
set search_path = flowdo, public
as $$
declare
  v_action text;
  v_user   uuid := coalesce(new.owner_id, old.owner_id);
begin
  if (tg_op = 'INSERT') then
    v_action := 'project.created';
  elsif (tg_op = 'DELETE') then
    v_action := 'project.deleted';
  elsif (new.status = 'ARCHIVED' and old.status is distinct from 'ARCHIVED') then
    v_action := 'project.archived';
  else
    v_action := 'project.updated';
  end if;

  insert into flowdo.activity_logs (user_id, task_id, project_id, action, metadata)
  values (
    v_user,
    null,
    case when tg_op = 'DELETE' then null else new.id end,
    v_action,
    case
      when tg_op = 'DELETE' then jsonb_build_object('project_id', old.id, 'name', old.name)
      else jsonb_build_object('name', new.name)
    end
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger log_project_activity
  after insert or update or delete on flowdo.projects
  for each row execute function flowdo.log_project_activity();
```

- [ ] **Step 2: Add migration-existence checks**

Append to `tests/integration/phase3-migrations.test.ts`:
```ts
  it("0008: activity triggers exist on tasks and projects", async () => {
    const rows = await queryLocalDb(
      `select tgname, tgrelid::regclass::text as tbl from pg_trigger
       where tgname in ('log_task_activity','log_project_activity')`
    );
    const map = Object.fromEntries(rows.rows.map((r) => [r.tgname, r.tbl]));
    expect(map["log_task_activity"]).toBe("flowdo.tasks");
    expect(map["log_project_activity"]).toBe("flowdo.projects");
  });
```

- [ ] **Step 3: Apply + run**

Run: `npx supabase db reset` then `npm run test:integration -- tests/integration/phase3-migrations.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0008_activity_log_triggers.sql tests/integration/phase3-migrations.test.ts
git commit -m "FLOWDO-4.10: record task and project activity via triggers (migration 0008)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```

---

## Task C2: Activity data layer + `describeActivity`

**Files:**
- Create: `lib/activity/activity.ts`, `lib/activity/format.ts`, `lib/activity/format.test.ts`
- Test: `lib/activity/format.test.ts`, `tests/integration/activity.test.ts`

**Interfaces:**
- Produces: `listActivity`, `describeActivity` (signatures above).

- [ ] **Step 1: Write the failing `describeActivity` test**

`lib/activity/format.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { describeActivity } from "./format";

describe("describeActivity", () => {
  it("describes task lifecycle actions", () => {
    expect(describeActivity({ action: "task.created", metadata: { title: "Ship docs" } })).toBe('Created "Ship docs"');
    expect(describeActivity({ action: "task.completed", metadata: { title: "Ship docs" } })).toBe("Completed this task");
    expect(describeActivity({ action: "task.reopened", metadata: null })).toBe("Reopened this task");
    expect(describeActivity({ action: "task.updated", metadata: null })).toBe("Updated this task");
    expect(describeActivity({ action: "task.deleted", metadata: { title: "Ship docs" } })).toBe('Deleted "Ship docs"');
  });

  it("describes project actions", () => {
    expect(describeActivity({ action: "project.created", metadata: { name: "Website" } })).toBe('Created project "Website"');
    expect(describeActivity({ action: "project.archived", metadata: { name: "Website" } })).toBe("Archived this project");
  });

  it("falls back to the raw action for anything unknown", () => {
    expect(describeActivity({ action: "task.frobnicated", metadata: null })).toBe("task.frobnicated");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- lib/activity/format.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/activity/format.ts`**

```ts
type Meta = Record<string, unknown> | null;

function str(meta: Meta, key: string): string {
  const v = meta?.[key];
  return typeof v === "string" ? v : "";
}

export function describeActivity(row: { action: string; metadata: Meta }): string {
  const { action, metadata } = row;
  switch (action) {
    case "task.created": return `Created "${str(metadata, "title")}"`;
    case "task.completed": return "Completed this task";
    case "task.reopened": return "Reopened this task";
    case "task.updated": return "Updated this task";
    case "task.deleted": return `Deleted "${str(metadata, "title")}"`;
    case "project.created": return `Created project "${str(metadata, "name")}"`;
    case "project.updated": return "Updated this project";
    case "project.archived": return "Archived this project";
    case "project.deleted": return `Deleted project "${str(metadata, "name")}"`;
    default: return action;
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- lib/activity/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement `lib/activity/activity.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type ActivityRow = Database["flowdo"]["Tables"]["activity_logs"]["Row"];
type Client = SupabaseClient<Database, "flowdo">;

export async function listActivity(
  supabase: Client,
  opts: { taskId?: string; projectId?: string; limit?: number }
) {
  let query = supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(opts.limit ?? 50);
  if (opts.taskId) query = query.eq("task_id", opts.taskId);
  if (opts.projectId) query = query.eq("project_id", opts.projectId);
  const { data, error } = await query;
  if (error) return { data: null, error: "Couldn't load activity. Please try again." };
  return { data: data as ActivityRow[], error: null };
}
```

- [ ] **Step 6: Write the integration test**

`tests/integration/activity.test.ts`:
```ts
import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient } from "../helpers/admin-client";
import { createConfirmedTestUser } from "../helpers/test-user";
import { createTask, updateTask, completeTask, reopenTask, deleteTask } from "@/lib/tasks/tasks";
import { createProject, archiveProject } from "@/lib/projects/projects";
import { listActivity } from "@/lib/activity/activity";

const admin = createAdminClient();
const createdUserIds: string[] = [];
afterEach(async () => {
  for (const id of createdUserIds.splice(0)) await admin.auth.admin.deleteUser(id);
});

describe("activity log triggers", () => {
  it("records create/update/complete/reopen for a task", async () => {
    const owner = await createConfirmedTestUser(admin, "activity-task@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const { data: task } = await createTask(owner.client, owner.userId, { title: "Track me" });
    await updateTask(owner.client, task!.id, { priority: "HIGH" });
    await completeTask(owner.client, task!.id);
    await reopenTask(owner.client, task!.id);

    const { data: activity } = await listActivity(owner.client, { taskId: task!.id });
    const actions = activity!.map((a) => a.action).reverse(); // oldest first
    expect(actions).toEqual(["task.created", "task.updated", "task.completed", "task.reopened"]);
  });

  it("records a delete with task_id null and the title in metadata (no FK violation)", async () => {
    const owner = await createConfirmedTestUser(admin, "activity-delete@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const { data: task } = await createTask(owner.client, owner.userId, { title: "Doomed" });
    const { error } = await deleteTask(owner.client, task!.id);
    expect(error).toBeNull();

    const { data: activity } = await listActivity(owner.client, { limit: 50 });
    const del = activity!.find((a) => a.action === "task.deleted");
    expect(del).toBeTruthy();
    expect(del!.task_id).toBeNull();
    expect((del!.metadata as Record<string, unknown>).title).toBe("Doomed");
  });

  it("records project create + archive", async () => {
    const owner = await createConfirmedTestUser(admin, "activity-project@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const { data: project } = await createProject(owner.client, owner.userId, { name: "Site", color: "#4F46E5", icon: "folder" });
    await archiveProject(owner.client, project!.id);

    const { data: activity } = await listActivity(owner.client, { projectId: project!.id });
    const actions = activity!.map((a) => a.action).reverse();
    expect(actions).toEqual(["project.created", "project.archived"]);
  });

  it("a user cannot read another user's activity", async () => {
    const owner = await createConfirmedTestUser(admin, "activity-rls-owner@example.com", "Password123!");
    const attacker = await createConfirmedTestUser(admin, "activity-rls-atk@example.com", "Password123!");
    createdUserIds.push(owner.userId, attacker.userId);

    const { data: task } = await createTask(owner.client, owner.userId, { title: "Private" });
    const { data: attackerView } = await listActivity(attacker.client, { taskId: task!.id });
    expect(attackerView).toEqual([]);
  });
});
```

- [ ] **Step 7: Run integration + unit + lint + typecheck**

Run: `npm run test:integration -- tests/integration/activity.test.ts && npm run lint && npm run typecheck && npm test`
Expected: all PASS. **Note:** existing integration tests that assert exact task counts still pass — activity rows are in a different table. If any existing test asserts "no other rows exist" globally, adjust it.

- [ ] **Step 8: Commit**

```bash
git add lib/activity/ tests/integration/activity.test.ts
git commit -m "FLOWDO-4.10: add activity list + human-readable activity formatting

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```

---

## Task C3: Activity feed in the detail panel + project overview

**Files:**
- Create: `components/tasks/activity-feed.tsx`
- Modify: `components/tasks/task-detail-panel.tsx` (mount for the task), `app/app/projects/[id]/page.tsx` (mount for the project)
- Test: fold a render check into `components/tasks/activity-feed.tsx` via a small `.test.tsx`

**Interfaces:**
- Consumes: `listActivity` (C2), `describeActivity` (C2).
- Produces: `<ActivityFeed taskId?={string} projectId?={string} />`.

- [ ] **Step 1: Write the failing test**

`components/tasks/activity-feed.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ActivityFeed } from "./activity-feed";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/activity/activity", () => ({
  listActivity: vi.fn().mockResolvedValue({
    data: [
      { id: "a2", action: "task.completed", metadata: null, created_at: "2026-03-15T10:00:00Z" },
      { id: "a1", action: "task.created", metadata: { title: "X" }, created_at: "2026-03-15T09:00:00Z" },
    ],
    error: null,
  }),
}));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => vi.clearAllMocks());

describe("ActivityFeed", () => {
  it("renders described activity lines newest first", async () => {
    wrap(<ActivityFeed taskId="t1" />);
    expect(await screen.findByText("Completed this task")).toBeInTheDocument();
    expect(screen.getByText('Created "X"')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- components/tasks/activity-feed.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `components/tasks/activity-feed.tsx`**

```tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { listActivity } from "@/lib/activity/activity";
import { describeActivity } from "@/lib/activity/format";

function relative(iso: string, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

export function ActivityFeed({ taskId, projectId }: { taskId?: string; projectId?: string }) {
  const supabase = createClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["activity", taskId ? "task" : "project", taskId ?? projectId],
    queryFn: async () => (await listActivity(supabase, { taskId, projectId })).data ?? [],
  });

  return (
    <section className="space-y-2 border-t border-border pt-4">
      <h3 className="text-sm font-medium">Activity</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No activity yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
              <span>{describeActivity(r)}</span>
              <span className="shrink-0 text-muted-foreground">{relative(r.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- components/tasks/activity-feed.test.tsx`
Expected: PASS.

- [ ] **Step 5: Mount it**

- `components/tasks/task-detail-panel.tsx`: import `ActivityFeed`; render `<ActivityFeed taskId={task.id} />` as the last child inside the `<form>` before the footer (or just after it, still inside `Dialog.Content`).
- `app/app/projects/[id]/page.tsx`: import `ActivityFeed`; add below `<TaskView>`:
```tsx
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Activity</h2>
        <ActivityFeed projectId={project.id} />
      </div>
```
The project page is a Server Component; `ActivityFeed` is a Client Component with `"use client"` — rendering it directly as a child is fine (no function props cross the boundary). It runs its own query against the browser client.

- [ ] **Step 6: Lint + typecheck + unit**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add components/tasks/activity-feed.tsx components/tasks/activity-feed.test.tsx \
  components/tasks/task-detail-panel.tsx "app/app/projects/[id]/page.tsx"
git commit -m "FLOWDO-4.11: show activity feed on task detail and project overview

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```

---

## Task C4: Migration `0009` — notification dismissals

**Files:**
- Create: `supabase/migrations/0009_notification_dismissals.sql`
- Modify: `tests/integration/phase3-migrations.test.ts`

**Interfaces:**
- Produces: `notifications.dedupe_key` (`text`, nullable), partial unique index `(user_id, dedupe_key)`, `notifications_insert_own` policy. (Types added in A3.)

- [ ] **Step 1: Write the migration**

`supabase/migrations/0009_notification_dismissals.sql`:
```sql
alter table flowdo.notifications add column dedupe_key text;

create unique index notifications_user_dedupe_key_idx
  on flowdo.notifications (user_id, dedupe_key)
  where dedupe_key is not null;

create policy "notifications_insert_own" on flowdo.notifications
  for insert with check (user_id = auth.uid());
```

- [ ] **Step 2: Add checks**

Append to `tests/integration/phase3-migrations.test.ts`:
```ts
  it("0009: notifications.dedupe_key + insert policy", async () => {
    const col = await queryLocalDb(
      `select is_nullable from information_schema.columns
       where table_schema='flowdo' and table_name='notifications' and column_name='dedupe_key'`
    );
    expect(col.rows[0]?.is_nullable).toBe("YES");

    const policy = await queryLocalDb(
      `select policyname from pg_policies
       where schemaname='flowdo' and tablename='notifications' and policyname='notifications_insert_own'`
    );
    expect(policy.rows.length).toBe(1);
  });
```

- [ ] **Step 3: Apply + run**

Run: `npx supabase db reset` then `npm run test:integration -- tests/integration/phase3-migrations.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0009_notification_dismissals.sql tests/integration/phase3-migrations.test.ts
git commit -m "FLOWDO-4.12: add notification dismissal column and insert policy (migration 0009)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```

---

## Task C5: `deriveNotifications` pure function

**Files:**
- Create: `lib/notifications/derive.ts`, `lib/notifications/derive.test.ts`

**Interfaces:**
- Consumes: `getTodayRange` from `lib/tasks/date-ranges.ts`.
- Produces: `DerivedNotification`, `deriveNotifications(tasks, readKeys, now)` (signatures above).

- [ ] **Step 1: Write the failing tests**

`lib/notifications/derive.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { deriveNotifications } from "./derive";

const now = new Date("2026-03-15T12:00:00.000Z");
const task = (o: Partial<Record<string, unknown>>) => ({
  id: "t", user_id: "u", project_id: null, parent_task_id: null, title: "T",
  description: null, status: "TODO", priority: "MEDIUM", due_date: null, completed_at: null,
  position: 0, created_at: "", updated_at: "", recurrence: "NEVER", recurrence_rule: null, ...o,
}) as never;

describe("deriveNotifications", () => {
  it("flags an overdue task", () => {
    const out = deriveNotifications([task({ id: "a", due_date: "2026-03-10T09:00:00Z" })], new Set(), now);
    expect(out.map((n) => n.type)).toContain("overdue");
    expect(out.find((n) => n.type === "overdue")!.key).toBe("overdue:a");
  });

  it("flags a task due within 24h as due-soon, not overdue", () => {
    const out = deriveNotifications([task({ id: "b", due_date: "2026-03-15T20:00:00Z" })], new Set(), now);
    expect(out.some((n) => n.type === "due-soon" && n.key === "due-soon:b")).toBe(true);
    expect(out.some((n) => n.type === "overdue")).toBe(false);
  });

  it("excludes completed tasks and subtasks", () => {
    const out = deriveNotifications([
      task({ id: "c", due_date: "2026-03-10T09:00:00Z", status: "COMPLETED" }),
      task({ id: "d", due_date: "2026-03-10T09:00:00Z", parent_task_id: "p" }),
    ], new Set(), now);
    expect(out.filter((n) => n.type !== "daily-summary")).toEqual([]);
  });

  it("emits one daily-summary when there is something due or overdue", () => {
    const out = deriveNotifications([task({ id: "e", due_date: "2026-03-10T09:00:00Z" })], new Set(), now);
    const summary = out.filter((n) => n.type === "daily-summary");
    expect(summary).toHaveLength(1);
    expect(summary[0].key).toBe("daily-summary:2026-03-15");
    expect(summary[0].message).toMatch(/overdue/);
  });

  it("emits no daily-summary when nothing is due or overdue", () => {
    const out = deriveNotifications([task({ id: "f", due_date: "2026-03-20T09:00:00Z" })], new Set(), now);
    expect(out.some((n) => n.type === "daily-summary")).toBe(false);
  });

  it("drops items whose key is in readKeys", () => {
    const out = deriveNotifications([task({ id: "g", due_date: "2026-03-10T09:00:00Z" })], new Set(["overdue:g"]), now);
    expect(out.some((n) => n.key === "overdue:g")).toBe(false);
  });

  it("sorts overdue before due-soon before summary", () => {
    const out = deriveNotifications([
      task({ id: "h", due_date: "2026-03-15T20:00:00Z" }),
      task({ id: "i", due_date: "2026-03-01T09:00:00Z" }),
    ], new Set(), now);
    expect(out.map((n) => n.type)).toEqual(["overdue", "due-soon", "daily-summary"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- lib/notifications/derive.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/notifications/derive.ts`**

```ts
import { getTodayRange } from "@/lib/tasks/date-ranges";
import type { Database } from "@/types/database";

type TaskRow = Database["flowdo"]["Tables"]["tasks"]["Row"];

export type DerivedNotification = {
  key: string;
  type: "overdue" | "due-soon" | "daily-summary";
  title: string;
  message: string;
  taskId: string | null;
  createdAt: string;
};

export function deriveNotifications(tasks: TaskRow[], readKeys: Set<string>, now: Date): DerivedNotification[] {
  const { start } = getTodayRange(now);
  const soonCutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000).getTime();
  const startMs = new Date(start).getTime();

  const open = tasks.filter((t) => t.status !== "COMPLETED" && t.parent_task_id === null && t.due_date);

  const overdue: DerivedNotification[] = [];
  const dueSoon: DerivedNotification[] = [];

  for (const t of open) {
    const due = new Date(t.due_date!).getTime();
    if (due < startMs) {
      overdue.push({
        key: `overdue:${t.id}`, type: "overdue", title: t.title,
        message: "Overdue", taskId: t.id, createdAt: t.due_date!,
      });
    } else if (due <= soonCutoff) {
      dueSoon.push({
        key: `due-soon:${t.id}`, type: "due-soon", title: t.title,
        message: "Due soon", taskId: t.id, createdAt: t.due_date!,
      });
    }
  }

  dueSoon.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  overdue.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const summary: DerivedNotification[] = [];
  const dueTodayCount = open.filter((t) => {
    const due = new Date(t.due_date!).getTime();
    return due >= startMs && due < startMs + 24 * 60 * 60 * 1000;
  }).length;
  if (dueTodayCount + overdue.length > 0) {
    const day = start.slice(0, 10);
    summary.push({
      key: `daily-summary:${day}`, type: "daily-summary", title: "Today's summary",
      message: `${dueTodayCount} due today · ${overdue.length} overdue`,
      taskId: null, createdAt: start,
    });
  }

  return [...overdue, ...dueSoon, ...summary].filter((n) => !readKeys.has(n.key));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- lib/notifications/derive.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Lint + typecheck**

Run: `npm run lint && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/notifications/derive.ts lib/notifications/derive.test.ts
git commit -m "FLOWDO-4.12: derive due-soon/overdue/daily-summary notifications from tasks

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```

---

## Task C6: Dismissal store + `hasDueDate` filter

**Files:**
- Create: `lib/notifications/notifications.ts`
- Modify: `lib/tasks/tasks.ts` (`hasDueDate` filter)
- Test: `tests/integration/notifications.test.ts`

**Interfaces:**
- Consumes: `DerivedNotification` (C5).
- Produces: `listReadKeys`, `markRead`, `markAllRead` (signatures above); `ListTasksFilters.hasDueDate`.

- [ ] **Step 1: Add `hasDueDate` to `listTasks`**

`lib/tasks/tasks.ts` — `ListTasksFilters` gains `hasDueDate?: boolean`; in `listTasks`:
```ts
  if (filters.hasDueDate) {
    query = query.not("due_date", "is", null);
  }
```

- [ ] **Step 2: Implement `lib/notifications/notifications.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { DerivedNotification } from "./derive";

type Client = SupabaseClient<Database, "flowdo">;

export async function listReadKeys(supabase: Client) {
  const { data, error } = await supabase.from("notifications").select("dedupe_key").not("dedupe_key", "is", null);
  if (error) return { data: null, error: "Couldn't load notifications. Please try again." };
  return { data: (data ?? []).map((r) => r.dedupe_key as string), error: null };
}

export async function markRead(supabase: Client, userId: string, items: DerivedNotification[]) {
  if (items.length === 0) return { error: null };
  const rows = items.map((n) => ({
    user_id: userId,
    dedupe_key: n.key,
    type: n.type,
    title: n.title,
    message: n.message,
    task_id: n.taskId,
    is_read: true,
  }));
  const { error } = await supabase.from("notifications").upsert(rows, { onConflict: "user_id,dedupe_key" });
  if (error) return { error: "Couldn't update notifications. Please try again." };
  return { error: null };
}

export async function markAllRead(supabase: Client, userId: string, items: DerivedNotification[]) {
  return markRead(supabase, userId, items);
}
```

- [ ] **Step 3: Write the integration test**

`tests/integration/notifications.test.ts`:
```ts
import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient } from "../helpers/admin-client";
import { createConfirmedTestUser } from "../helpers/test-user";
import { createTask, listTasks } from "@/lib/tasks/tasks";
import { listReadKeys, markRead } from "@/lib/notifications/notifications";
import { deriveNotifications } from "@/lib/notifications/derive";
import type { DerivedNotification } from "@/lib/notifications/derive";

const admin = createAdminClient();
const createdUserIds: string[] = [];
afterEach(async () => {
  for (const id of createdUserIds.splice(0)) await admin.auth.admin.deleteUser(id);
});

const overdueItem = (taskId: string): DerivedNotification => ({
  key: `overdue:${taskId}`, type: "overdue", title: "X", message: "Overdue", taskId, createdAt: new Date().toISOString(),
});

describe("notification dismissals", () => {
  it("markRead upserts a dismissal row and listReadKeys returns it; re-running is idempotent", async () => {
    const owner = await createConfirmedTestUser(admin, "notif-mark@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    await markRead(owner.client, owner.userId, [overdueItem("task-1")]);
    await markRead(owner.client, owner.userId, [overdueItem("task-1")]); // idempotent (onConflict)

    const { data: keys } = await listReadKeys(owner.client);
    expect(keys).toEqual(["overdue:task-1"]);
  });

  it("a user cannot read another user's dismissal keys", async () => {
    const owner = await createConfirmedTestUser(admin, "notif-rls-owner@example.com", "Password123!");
    const attacker = await createConfirmedTestUser(admin, "notif-rls-atk@example.com", "Password123!");
    createdUserIds.push(owner.userId, attacker.userId);

    await markRead(owner.client, owner.userId, [overdueItem("secret")]);
    const { data: keys } = await listReadKeys(attacker.client);
    expect(keys).toEqual([]);
  });

  it("hasDueDate filter returns only dated tasks and feeds derive end to end", async () => {
    const owner = await createConfirmedTestUser(admin, "notif-e2e@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    await createTask(owner.client, owner.userId, { title: "Overdue", dueDate: "2020-01-01T09:00:00.000Z" });
    await createTask(owner.client, owner.userId, { title: "No date" });

    const { data: tasks } = await listTasks(owner.client, { excludeCompleted: true, parentTaskId: null, hasDueDate: true });
    expect(tasks?.map((t) => t.title)).toEqual(["Overdue"]);

    const derived = deriveNotifications(tasks ?? [], new Set(), new Date());
    expect(derived.some((n) => n.type === "overdue")).toBe(true);
  });
});
```

- [ ] **Step 4: Run integration + unit + lint + typecheck**

Run: `npm run test:integration -- tests/integration/notifications.test.ts && npm run lint && npm run typecheck && npm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/notifications/notifications.ts lib/tasks/tasks.ts tests/integration/notifications.test.ts
git commit -m "FLOWDO-4.13: add notification dismissal store and hasDueDate filter

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```

---

## Task C7: Notification bell in the topbar

**Files:**
- Create: `components/notifications/notification-bell.tsx`, `components/notifications/notification-bell.test.tsx`
- Modify: `app/app/layout.tsx` (fetch + render the bell)

**Interfaces:**
- Consumes: `deriveNotifications` (C5), `markRead`/`markAllRead` (C6), `listTasks`/`listReadKeys`.
- Produces: `<NotificationBell tasks={TaskRow[]} readKeys={string[]} userId={string} />`.

- [ ] **Step 1: Write the failing component test**

`components/notifications/notification-bell.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationBell } from "./notification-bell";

const markAllRead = vi.fn().mockResolvedValue({ error: null });
const markRead = vi.fn().mockResolvedValue({ error: null });
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/notifications/notifications", () => ({
  markAllRead: (...a: unknown[]) => markAllRead(...a),
  markRead: (...a: unknown[]) => markRead(...a),
}));

const task = (o: Partial<Record<string, unknown>>) => ({
  id: "t", user_id: "u", project_id: null, parent_task_id: null, title: "T",
  description: null, status: "TODO", priority: "MEDIUM", due_date: null, completed_at: null,
  position: 0, created_at: "", updated_at: "", recurrence: "NEVER", recurrence_rule: null, ...o,
});

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => vi.clearAllMocks());

describe("NotificationBell", () => {
  it("shows an unread count derived from tasks", async () => {
    wrap(<NotificationBell userId="u" readKeys={[]} tasks={[
      task({ id: "a", title: "Old", due_date: "2020-01-01T00:00:00Z" }),
    ] as never} />);
    expect(await screen.findByLabelText(/2 unread notifications/i)).toBeInTheDocument(); // overdue + summary
  });

  it("Mark all read clears the badge", async () => {
    const user = userEvent.setup();
    wrap(<NotificationBell userId="u" readKeys={[]} tasks={[
      task({ id: "a", title: "Old", due_date: "2020-01-01T00:00:00Z" }),
    ] as never} />);
    await user.click(screen.getByLabelText(/unread notifications/i));
    await user.click(await screen.findByRole("button", { name: /mark all read/i }));
    expect(markAllRead).toHaveBeenCalled();
  });

  it("renders the empty state when nothing is due", async () => {
    const user = userEvent.setup();
    wrap(<NotificationBell userId="u" readKeys={[]} tasks={[] as never} />);
    await user.click(screen.getByLabelText(/notifications/i));
    expect(await screen.findByText(/all caught up/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- components/notifications/notification-bell.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `components/notifications/notification-bell.tsx`**

```tsx
"use client";
import * as React from "react";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { useRouter } from "next/navigation";
import { Bell, AlertTriangle, Clock, ListChecks } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { deriveNotifications, type DerivedNotification } from "@/lib/notifications/derive";
import { markRead, markAllRead } from "@/lib/notifications/notifications";
import type { Database } from "@/types/database";

type TaskRow = Database["flowdo"]["Tables"]["tasks"]["Row"];

const ICON = { overdue: AlertTriangle, "due-soon": Clock, "daily-summary": ListChecks } as const;

export function NotificationBell({
  tasks,
  readKeys,
  userId,
}: {
  tasks: TaskRow[];
  readKeys: string[];
  userId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  // Local optimistic dismissal set layered on top of the server-provided readKeys.
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());
  const allRead = React.useMemo(() => new Set([...readKeys, ...dismissed]), [readKeys, dismissed]);
  const items = React.useMemo(() => deriveNotifications(tasks, allRead, new Date()), [tasks, allRead]);

  async function openItem(n: DerivedNotification) {
    setDismissed((s) => new Set(s).add(n.key));
    await markRead(supabase, userId, [n]);
    if (n.taskId) router.push("/app/upcoming");
    router.refresh();
  }

  async function clearAll() {
    setDismissed((s) => new Set([...s, ...items.map((i) => i.key)]));
    await markAllRead(supabase, userId, items);
    router.refresh();
  }

  const count = items.length;

  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button
          aria-label={count > 0 ? `${count} unread notifications` : "Notifications"}
          className="relative rounded-md p-1.5 hover:bg-muted"
        >
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {count}
            </span>
          )}
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content align="end" sideOffset={8}
          className="z-50 w-80 rounded-md border border-border bg-background p-2 shadow-lg">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-sm font-medium">Notifications</span>
            {count > 0 && (
              <button type="button" onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground">
                Mark all read
              </button>
            )}
          </div>
          {count === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((n) => {
                const Icon = ICON[n.type];
                return (
                  <li key={n.key}>
                    <button type="button" onClick={() => openItem(n)}
                      className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-muted">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{n.title}</span>
                        <span className="block text-xs text-muted-foreground">{n.message}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
```

- [ ] **Step 4: Run the component test**

Run: `npm test -- components/notifications/notification-bell.test.tsx`
Expected: PASS (3 tests). If jsdom trips on Radix Dropdown portalling, the existing repo pattern for Radix Dialog tests (see `task-detail-panel.test.tsx`) applies — follow it.

- [ ] **Step 5: Wire into `app/app/layout.tsx`**

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listTasks } from "@/lib/tasks/tasks";
import { listReadKeys } from "@/lib/notifications/notifications";
import { Sidebar } from "@/components/dashboard/sidebar";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { UserMenu } from "@/components/dashboard/user-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: bellTasks }, { data: readKeys }] = await Promise.all([
    listTasks(supabase, { excludeCompleted: true, parentTaskId: null, hasDueDate: true, limit: 200 }),
    listReadKeys(supabase),
  ]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <MobileNav />
            <span className="font-semibold">FlowDo</span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell tasks={bellTasks ?? []} readKeys={readKeys ?? []} userId={user.id} />
            <UserMenu email={user.email ?? ""} />
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Full lint + typecheck + unit + build**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add components/notifications/ app/app/layout.tsx
git commit -m "FLOWDO-4.13 FLOWDO-4.14: add notification bell with unread count to the topbar

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```

---

## Task C8: Wave C checkpoint + branch finish

**Files:** none (verification + handoff).

- [ ] **Step 1: Full verification**

Run: `npx supabase db reset` then
`npm run lint && npm run typecheck && npm test && npm run test:integration && npm run build`
Expected: all green. Re-run `npm run test:integration` once if only `tests/integration/profile.test.ts` fails (known flake).

- [ ] **Step 2: Full manual smoke test (spec "Verification before done")**

Sign in and walk: 3 subtasks + progress; create + assign + filter by a label; calendar month paging + create-from-day + open detail; Weekly recurrence complete → next occurrence + original in Completed; task activity feed shows created/completed; let a task go overdue → bell count + overdue item → Mark all read → reload → stays read; project overview Activity section populated.

- [ ] **Step 3: Update `README.md`**

Add a "Phase 3 status" section mirroring the existing "Phase 2 status" block: list what shipped (subtasks, labels, calendar, recurrence, activity log, derived notifications), note the derived-notifications / no-cron decision and the `ponytail:` dismissal-row caveat, and that full verification passes.

- [ ] **Step 4: Commit the README**

```bash
git add README.md
git commit -m "FLOWDO-4: document Phase 3 in the README

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```

- [ ] **Step 5: Code review**

Invoke `superpowers:requesting-code-review` for the whole `flowdo-4-phase3` branch vs `main`. Triage findings with `superpowers:receiving-code-review`, fix valid ones (each fix: test → implement → verify → commit with the relevant `FLOWDO-4.N:` prefix), re-run the full verification suite.

- [ ] **Step 6: Finish the branch**

Invoke `superpowers:finishing-a-development-branch`. Open the PR to `main`:
- Title: `FLOWDO-4: Phase 3 — subtasks, labels, calendar, recurring tasks, activity, notifications`
- Body: summarise per work item (4.1–4.14), link the spec, note migrations `0007`–`0009` and the manual hosted-Supabase step (none needed — no exposed-schema or template changes this phase), paste the final verification output.
- Footer: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

---

## Self-Review

**1. Spec coverage**

| Spec item | Task |
|---|---|
| Subtasks CRUD (`4.1`) | A1 (data), A2 (UI) |
| Subtask progress indicator (`4.2`) | A2 |
| Labels CRUD (`4.3`) | A3 (data), A5 (dialog) |
| Assign/remove labels + filter by label (`4.4`) | A3 (`setTaskLabels`), A4 (filter), A6 (UI) |
| Calendar monthly view (`4.5`) | B5 (grid math), B6 (page), B7 (component) |
| Calendar create-from-day (`4.6`) | B7 (`CreateTaskDialog`) |
| Calendar open task detail (`4.7`) | B7 (`TaskDetailPanel` reuse) |
| Recurrence rule Never…Custom (`4.8`) | B1 (schema), B2 (`nextDueDate`), B4 (field) |
| Generate next occurrence on complete (`4.9`) | B3 (`completeTask`) |
| Activity log create/update/complete/delete (`4.10`) | C1 (triggers), C2 (list) |
| Activity feed UI on task detail (`4.11`) | C3 |
| Due-soon + overdue notifications (`4.12`) | C4 (schema), C5 (`deriveNotifications`) |
| Daily summary notification (`4.13`) | C5 (summary), C6 (dismissals) |
| Notification center / bell + unread count (`4.14`) | C7 |
| DELETE-trigger FK null + metadata snapshot | C1 + C2 test |
| Recurrence month-end clamp | B2 tests |
| Subtask exclusion from flat views + dashboard | A1 |
| `types/database.ts` hand-edits per migration | A3 (tables), B1/C4 (confirm) |
| Detail-panel split | A2 / A5 / B4 / C3 (incremental) |
| Project activity section | C3 |
| README Phase 3 status | C8 |

No gaps.

**2. Placeholder scan** — no "TBD"/"handle edge cases"/"write tests for the above"; every code step has a real block. The few "match the existing setup if it differs" notes point at concrete files (`task-detail-panel.test.tsx`, `task-filters.test.tsx`) an executor can open — acceptable, not a placeholder.

**3. Type consistency** — `nextDueDate(current, recurrence, rule)` used identically in B2/B3/B4. `DerivedNotification` shape identical in C5/C6/C7. `ListTasksFilters` additions (`parentTaskId` A1, `labelId` A4, `dueDateRange` B6, `hasDueDate` C6) are additive and each guarded by `!== undefined` / truthiness. `setTaskLabels(supabase, taskId, labelIds)` consistent A3/A5/B7. `<TaskDetailPanel>` gains `userId` (A2) and `onLabelsChange` (A5) — every later mount (B7 calendar, C3) passes both. `subtaskProgress(rows: {status}[])` consistent A1/A2.

**4. Scope** — three waves, each independently shippable and verifiable; one plan is appropriate since the waves share the detail panel and `listTasks`.

