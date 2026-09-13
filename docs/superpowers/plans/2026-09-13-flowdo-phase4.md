# FlowDo Phase 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a productivity analytics dashboard, project members with roles, and Supabase Realtime collaboration on top of Phase 3's subtasks/labels/calendar/recurrence/activity/notifications.

**Architecture:** Keep every existing pattern — small typed functions in `lib/*` that take a Supabase client and do one operation and return `{data, error}`/`{error}`; Server Components for first paint, TanStack Query for interaction; no Next.js Server Actions; authorization is RLS; URL search params hold shareable view state. Analytics is one narrow query (`id,status,priority,project_id,due_date,completed_at`) plus pure in-memory aggregation functions — no new tables, no materialized views. Project members reuses the `project_members` table and `member_role` enum that already exist from Phase 1/2's schema but were never wired into the tasks RLS policies or given a UI; this phase closes that gap. Realtime is additive: Supabase's `postgres_changes` protocol over the two tables that already carry per-project signal (`tasks`, `activity_logs`), gated by the same RLS this plan strengthens in Wave E.

**Tech Stack:** Next.js 14 App Router, TypeScript (strict), Supabase (`@supabase/ssr`, `flowdo` schema, RLS, Realtime), TanStack Query v5, Radix (Dialog), Lucide, Vitest + RTL. **No new npm dependencies.**

**Spec:** `/Users/apple/flowdo/CLAUDE.md` §22 (Analytics), §23 (Realtime), §37 (Phase 4 roadmap) — read it alongside this plan. There is no separate design-spec doc for Phase 4 (unlike Phase 3's `docs/superpowers/specs/2026-09-07-flowdo-phase3-design.md`); CLAUDE.md is the governing spec directly.

## Global Constraints

- **No new npm dependencies.** Charts are hand-rolled (no charting library); the invite dialog and role controls reuse the existing Radix `Dialog`, `Button`, and `Input` primitives.
- **No Next.js Server Actions.** Mutations are plain functions in `lib/*` called from TanStack Query mutations (browser client) or Server Components (server client), exactly like `lib/tasks/tasks.ts`.
- **All authorization is RLS.** Never filter by a client-supplied `user_id` for authorization. This codebase's actual convention (verified by grepping every file under `lib/`: zero occurrences of `.eq("user_id", ...)` anywhere) is to rely on RLS alone with no redundant client-side filter — `listTasks`, `listProjects`, and `listLabels` all do this. `getAnalyticsSnapshot` (Task D2) follows the same convention.
- **UTC date math only**, consistent with `lib/tasks/date-ranges.ts` and `lib/calendar/month.ts` — never `toLocaleDateString`/`Intl` in rendered output (hydration mismatch risk). Analytics trend bucket labels are built from explicit UTC month-name arrays, exactly like the recurrence/calendar code from Phase 3.
- **`types/database.ts` is hand-maintained** (not `supabase gen types`). Every migration in this plan needs a matching hand-edit.
- **Error strings are human-readable**, matching every existing `lib/` function's `{data:null, error:"Couldn't …"}` shape.
- **RLS broadening can be a necessary, deliberate part of a feature's scope, not scope creep** — called out explicitly wherever it happens in this plan, with the reasoning written into the migration's own SQL comment, not silently assumed:
  - Wave E broadens `tasks_select_own`/`tasks_insert_own`/`tasks_update_own`/`tasks_delete_own` to recognize project membership. Without this, joining a project as a member would grant zero visibility into or control over that project's tasks — "project members" would be a hollow feature.
  - Wave E also broadens `profiles` visibility (a new `profiles_select_project_mate` policy, plus a narrow `find_user_id_by_email` RPC) because the member list needs to show other members' names/emails, and inviting needs to look someone up by email — neither works under the existing owner-only `profiles_select_own`. This does **not** make `profiles` universally readable (that would break the existing "prevents a user from reading another user's profile row" guarantee in `tests/integration/rls.test.ts` for unrelated users) — visibility is scoped to people who actually share a project, and the email lookup returns only an id, not a full profile.
- **Integration tests run against a HOSTED Supabase project** via `.env.test.local` (gitignored) — NOT local Docker. `npx supabase db push` applies migrations to hosted directly (no `db reset`, ever — it's a shared dev database with real data). `npm run test:integration` runs directly, no `supabase start` prerequisite. Test files run serially (`fileParallelism: false`) and sign-ins retry on Supabase's rate-limit bursts automatically (`tests/helpers/test-user.ts`) — nothing extra needed from new tests.
- **Verification per task:** `npm run lint && npm run typecheck && npm test` before every commit. **Per wave checkpoint:** additionally `npm run test:integration` and `npm run build`.
- **Commit message convention:** subject prefixed with the real Kaido work-item key(s). This phase's ticket is **`FLOWDO-4`** ("Phase 4 — Analytics, Realtime Collaboration, Project Members/Roles"), with its own work items 1–11 — this is the first plan where `FLOWDO-4.N` is the *correct* prefix (unlike Phase 3, which briefly used `FLOWDO-4.N` by mistake before it was corrected to `FLOWDO-3.N`). Footer:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3
  ```
- **Branch:** all work on `flowdo-phase4` (created in Task D0 via `superpowers:using-git-worktrees`, branched from `main` — Phase 3 already merged into `main`, so `main` is the current base). One PR to `main` after Wave F (Task F4), mirroring exactly how Phase 3 ran on `flowdo-4-phase3`.

---

## File Structure

### Created — Wave D (Analytics)

| File | Responsibility |
|---|---|
| `lib/analytics/aggregate.ts` | Pure functions: `countByStatus`, `completionRate`, `countOverdue`, `groupByProject`, `groupByPriority`, `bucketCompletionTrend` |
| `lib/analytics/aggregate.test.ts` | Unit tests for all six |
| `lib/analytics/analytics.ts` | `getAnalyticsSnapshot` — the one narrow query |
| `tests/integration/analytics.test.ts` | RLS + exact-shape test for `getAnalyticsSnapshot` |
| `components/analytics/stat-tiles.tsx` | Four stat tiles (Created/Completed/Completion rate/Overdue) |
| `components/analytics/stat-tiles.test.tsx` | Component test |
| `components/analytics/bar-chart.tsx` | Reusable hand-rolled horizontal bar chart |
| `components/analytics/bar-chart.test.tsx` | Component test |
| `components/analytics/trend-chart.tsx` | Period toggle (daily/weekly/monthly) + `BarChart` reuse |
| `components/analytics/trend-chart.test.tsx` | Component test |

### Created — Wave E (Project Members & Roles)

| File | Responsibility |
|---|---|
| `supabase/migrations/0012_project_member_roles_and_task_access.sql` | `project_members_update_admin` policy; project-member-aware tasks RLS; `profiles_select_project_mate` policy; `find_user_id_by_email` RPC |
| `tests/integration/phase4-migrations.test.ts` | Raw-SQL RLS tests for migration 0012 (and, from Wave F, 0013) |
| `lib/projects/members.ts` | `listMembers`, `inviteMemberByEmail`, `updateMemberRole`, `removeMember` |
| `tests/integration/members.test.ts` | Multi-user RLS tests for the data layer |
| `components/projects/member-list.tsx` | Member list (built incrementally across E3→E5: display, then invite button, then role/remove controls) |
| `components/projects/member-list.test.tsx` | Component test (extended across E3→E5) |
| `components/projects/invite-member-dialog.tsx` | Radix dialog: email + role, admin/owner only |
| `components/projects/invite-member-dialog.test.tsx` | Component test |

### Created — Wave F (Realtime Collaboration)

| File | Responsibility |
|---|---|
| `supabase/migrations/0013_enable_realtime_tasks_activity.sql` | Adds `flowdo.tasks` and `flowdo.activity_logs` to the `supabase_realtime` publication |
| `lib/realtime/use-realtime-tasks.ts` | `useRealtimeTasks` hook |
| `lib/realtime/use-realtime-tasks.test.ts` | Hook test with a mocked Supabase channel |
| `lib/realtime/use-realtime-activity.ts` | `useRealtimeActivity` hook |
| `lib/realtime/use-realtime-activity.test.ts` | Hook test with a mocked Supabase channel |

### Modified

| File | Change |
|---|---|
| `types/database.ts` | Add `project_members` table type; add `Functions.find_user_id_by_email` (Wave E) |
| `app/app/analytics/page.tsx` | Replace the static stub entirely (Wave D) |
| `app/app/projects/[id]/page.tsx` | Fetch members + compute `currentUserRole`, mount `<MemberList>` (Wave E) |
| `components/tasks/task-view.tsx` | Wire `useRealtimeTasks` (Wave F) |
| `components/tasks/task-view.test.tsx` | Add a realtime-wiring test (Wave F) |
| `components/tasks/activity-feed.tsx` | Wire `useRealtimeActivity` (Wave F) |

---

## Interfaces locked by this plan

Copy these signatures verbatim where a task says "Consumes":

```ts
// lib/analytics/aggregate.ts
export type MinimalTaskRow = {
  id: string;
  status: "TODO" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  project_id: string | null;
  due_date: string | null;
  completed_at: string | null;
};
export function countByStatus(tasks: MinimalTaskRow[]): { created: number; completed: number };
export function completionRate(created: number, completed: number): number;
export function countOverdue(tasks: MinimalTaskRow[], now: Date): number;
export function groupByProject(tasks: MinimalTaskRow[], projects: { id: string; name: string }[]): { label: string; count: number }[];
export function groupByPriority(tasks: MinimalTaskRow[]): { label: "LOW" | "MEDIUM" | "HIGH" | "URGENT"; count: number }[];
export function bucketCompletionTrend(
  tasks: MinimalTaskRow[],
  period: "daily" | "weekly" | "monthly",
  now: Date
): { label: string; count: number }[];

// lib/analytics/analytics.ts
type Client = SupabaseClient<Database, "flowdo">;
export function getAnalyticsSnapshot(supabase: Client): Promise<{ data: MinimalTaskRow[] | null; error: string | null }>;

// components/analytics/stat-tiles.tsx
export function StatTiles(props: { created: number; completed: number; completionRate: number; overdue: number }): JSX.Element;

// components/analytics/bar-chart.tsx
export function BarChart(props: { data: { label: string; count: number }[]; title: string }): JSX.Element;

// components/analytics/trend-chart.tsx
export function TrendChart(props: { data: { label: string; count: number }[]; period: "daily" | "weekly" | "monthly" }): JSX.Element;

// lib/projects/members.ts
type MemberRow = Database["flowdo"]["Tables"]["project_members"]["Row"];   // role: "OWNER"|"ADMIN"|"MEMBER"|"VIEWER"
type ProfileRow = Database["flowdo"]["Tables"]["profiles"]["Row"];
export type MemberWithProfile = MemberRow & {
  profile: Pick<ProfileRow, "full_name" | "email" | "avatar_url"> | null;
};
export function listMembers(supabase: Client, projectId: string): Promise<{ data: MemberWithProfile[] | null; error: string | null }>;
export function inviteMemberByEmail(supabase: Client, projectId: string, email: string, role: MemberRow["role"]):
  Promise<{ data: MemberRow | null; error: string | null }>;
export function updateMemberRole(supabase: Client, projectId: string, userId: string, role: MemberRow["role"]): Promise<{ error: string | null }>;
export function removeMember(supabase: Client, projectId: string, userId: string): Promise<{ error: string | null }>;

// components/projects/member-list.tsx
export function MemberList(props: {
  projectId: string;
  initialMembers: MemberWithProfile[];
  currentUserRole: MemberRow["role"];
}): JSX.Element;

// components/projects/invite-member-dialog.tsx
export function InviteMemberDialog(props: { projectId: string; open: boolean; onOpenChange: (open: boolean) => void }): JSX.Element;

// lib/realtime/use-realtime-tasks.ts
// Deviates from a plain `projectId: string` — TaskView is shared by both
// project-scoped and non-project-scoped views (Inbox/Today/Upcoming/
// Completed), and a hook can't be called conditionally, so it takes
// `string | null` and no-ops when null.
export function useRealtimeTasks(projectId: string | null, onChange: () => void): void;

// lib/realtime/use-realtime-activity.ts
export function useRealtimeActivity(projectId: string | null, onChange: () => void): void;
```

`TaskRow` everywhere still means `Database["flowdo"]["Tables"]["tasks"]["Row"]` (Phase 3's convention).

---

# WAVE D — Analytics (FLOWDO-4.1 through FLOWDO-4.6)

## Task D0: Create the Phase 4 branch

**Files:** none (workspace setup only).

- [ ] **Step 1: Create the feature branch**

Invoke `superpowers:using-git-worktrees` to create an isolated worktree/branch named `flowdo-phase4`, branched from `main` (Phase 3 already merged into `main` at the end of its own checkpoint, so `main` is the current base). Every task in Waves D, E, and F commits to this branch; Task F4 opens the PR back to `main`.

- [ ] **Step 2: Confirm the branch is checked out**

Run: `git branch --show-current`
Expected: `flowdo-phase4` (or the worktree's actual branch name if `using-git-worktrees` names it differently — confirm before continuing; every later task's commits must land here, not on `main`).

---

## Task D1: Pure aggregation functions

**Files:**
- Create: `lib/analytics/aggregate.ts`, `lib/analytics/aggregate.test.ts`

**Interfaces:**
- Consumes: `isBefore` from `lib/tasks/date-ranges.ts`; the Monday-first week convention from `lib/calendar/month.ts`'s `mondayIndex`.
- Produces: `MinimalTaskRow`, `countByStatus`, `completionRate`, `countOverdue`, `groupByProject`, `groupByPriority`, `bucketCompletionTrend` (signatures above).

This one module maps to several FLOWDO-4.N work items at once: `countByStatus`/`completionRate` are FLOWDO-4.1/4.2 (created/completed/completion-rate metrics), `countOverdue` is FLOWDO-4.3, and `groupByProject`/`groupByPriority`/`bucketCompletionTrend` are covered again by later UI tasks (D3/D4/D5) under their own tags — tagging this whole task `FLOWDO-4.1 FLOWDO-4.2 FLOWDO-4.3` since those are the metrics with no later task of their own.

- [ ] **Step 1: Write the failing tests**

`lib/analytics/aggregate.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  countByStatus,
  completionRate,
  countOverdue,
  groupByProject,
  groupByPriority,
  bucketCompletionTrend,
  type MinimalTaskRow,
} from "./aggregate";

function task(over: Partial<MinimalTaskRow>): MinimalTaskRow {
  return {
    id: "t",
    status: "TODO",
    priority: "MEDIUM",
    project_id: null,
    due_date: null,
    completed_at: null,
    ...over,
  };
}

describe("countByStatus", () => {
  it("returns 0/0 for no tasks", () => {
    expect(countByStatus([])).toEqual({ created: 0, completed: 0 });
  });

  it("counts created as every row and completed as COMPLETED-status rows", () => {
    const tasks = [
      task({ status: "TODO" }),
      task({ status: "COMPLETED" }),
      task({ status: "COMPLETED" }),
      task({ status: "CANCELLED" }),
    ];
    expect(countByStatus(tasks)).toEqual({ created: 4, completed: 2 });
  });
});

describe("completionRate", () => {
  it("is 0 when created is 0", () => {
    expect(completionRate(0, 0)).toBe(0);
  });

  it("rounds to the nearest percent", () => {
    expect(completionRate(3, 1)).toBe(33);
    expect(completionRate(3, 2)).toBe(67);
  });

  it("is 100 when everything is completed", () => {
    expect(completionRate(5, 5)).toBe(100);
  });
});

describe("countOverdue", () => {
  const now = new Date("2026-03-15T12:00:00.000Z");

  it("is 0 for no tasks", () => {
    expect(countOverdue([], now)).toBe(0);
  });

  it("counts a non-completed task with a past due date", () => {
    expect(countOverdue([task({ due_date: "2026-03-14T00:00:00.000Z" })], now)).toBe(1);
  });

  it("does not count a completed task even if its due date is past", () => {
    expect(countOverdue([task({ status: "COMPLETED", due_date: "2026-03-14T00:00:00.000Z" })], now)).toBe(0);
  });

  it("does not count a task with no due date", () => {
    expect(countOverdue([task({ due_date: null })], now)).toBe(0);
  });

  it("does not count a task due exactly at `now` or later", () => {
    expect(countOverdue([task({ due_date: "2026-03-15T12:00:00.000Z" })], now)).toBe(0);
    expect(countOverdue([task({ due_date: "2026-03-15T12:00:00.001Z" })], now)).toBe(0);
  });
});

describe("groupByProject", () => {
  it("returns an empty array for no tasks", () => {
    expect(groupByProject([], [])).toEqual([]);
  });

  it("labels a null project_id as Inbox", () => {
    expect(groupByProject([task({ project_id: null })], [])).toEqual([{ label: "Inbox", count: 1 }]);
  });

  it("groups all-same-project tasks into one row", () => {
    const projects = [{ id: "p1", name: "Launch" }];
    const tasks = [task({ project_id: "p1" }), task({ project_id: "p1" }), task({ project_id: "p1" })];
    expect(groupByProject(tasks, projects)).toEqual([{ label: "Launch", count: 3 }]);
  });

  it("sorts by count descending", () => {
    const projects = [{ id: "p1", name: "A" }, { id: "p2", name: "B" }];
    const tasks = [task({ project_id: "p1" }), task({ project_id: "p2" }), task({ project_id: "p2" }), task({ project_id: "p2" })];
    expect(groupByProject(tasks, projects)).toEqual([
      { label: "B", count: 3 },
      { label: "A", count: 1 },
    ]);
  });
});

describe("groupByPriority", () => {
  it("includes all 4 priorities in order even at zero", () => {
    expect(groupByPriority([])).toEqual([
      { label: "LOW", count: 0 },
      { label: "MEDIUM", count: 0 },
      { label: "HIGH", count: 0 },
      { label: "URGENT", count: 0 },
    ]);
  });

  it("counts each task under its own priority", () => {
    const tasks = [task({ priority: "URGENT" }), task({ priority: "URGENT" }), task({ priority: "LOW" })];
    expect(groupByPriority(tasks)).toEqual([
      { label: "LOW", count: 1 },
      { label: "MEDIUM", count: 0 },
      { label: "HIGH", count: 0 },
      { label: "URGENT", count: 2 },
    ]);
  });
});

describe("bucketCompletionTrend", () => {
  const now = new Date("2026-03-15T12:00:00.000Z"); // a Sunday

  it("daily: returns 14 zero-filled buckets ending today", () => {
    const buckets = bucketCompletionTrend([], "daily", now);
    expect(buckets).toHaveLength(14);
    expect(buckets[13]).toEqual({ label: "Mar 15", count: 0 });
    expect(buckets[0]).toEqual({ label: "Mar 2", count: 0 });
  });

  it("daily: places a completed task in its UTC day bucket", () => {
    const tasks = [task({ completed_at: "2026-03-15T23:59:59.000Z" })];
    const buckets = bucketCompletionTrend(tasks, "daily", now);
    expect(buckets[13]).toEqual({ label: "Mar 15", count: 1 });
  });

  it("ignores tasks with no completed_at", () => {
    const tasks = [task({ completed_at: null, status: "TODO" })];
    const buckets = bucketCompletionTrend(tasks, "daily", now);
    expect(buckets.reduce((sum, b) => sum + b.count, 0)).toBe(0);
  });

  it("weekly: returns 8 Monday-first buckets ending this week", () => {
    const buckets = bucketCompletionTrend([], "weekly", now);
    expect(buckets).toHaveLength(8);
    // 2026-03-15 is a Sunday; that week's Monday is 2026-03-09.
    expect(buckets[7]).toEqual({ label: "Mar 9", count: 0 });
  });

  it("weekly: places a completed task in its Monday-start week bucket", () => {
    const tasks = [task({ completed_at: "2026-03-11T00:00:00.000Z" })]; // Wednesday of the week starting Mar 9
    const buckets = bucketCompletionTrend(tasks, "weekly", now);
    expect(buckets[7]).toEqual({ label: "Mar 9", count: 1 });
  });

  it("monthly: returns 6 month buckets ending this month", () => {
    const buckets = bucketCompletionTrend([], "monthly", now);
    expect(buckets).toHaveLength(6);
    expect(buckets[5]).toEqual({ label: "Mar 2026", count: 0 });
    expect(buckets[0]).toEqual({ label: "Oct 2025", count: 0 });
  });

  it("monthly: places a completed task in its year-month bucket", () => {
    const tasks = [task({ completed_at: "2026-01-20T00:00:00.000Z" })];
    const buckets = bucketCompletionTrend(tasks, "monthly", now);
    expect(buckets.find((b) => b.label === "Jan 2026")).toEqual({ label: "Jan 2026", count: 1 });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- lib/analytics/aggregate.test.ts`
Expected: FAIL — module `./aggregate` not found.

- [ ] **Step 3: Implement `lib/analytics/aggregate.ts`**

```ts
import { isBefore } from "@/lib/tasks/date-ranges";

export type MinimalTaskRow = {
  id: string;
  status: "TODO" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  project_id: string | null;
  due_date: string | null;
  completed_at: string | null;
};

export function countByStatus(tasks: MinimalTaskRow[]): { created: number; completed: number } {
  return {
    created: tasks.length,
    completed: tasks.filter((t) => t.status === "COMPLETED").length,
  };
}

export function completionRate(created: number, completed: number): number {
  return created === 0 ? 0 : Math.round((completed / created) * 100);
}

export function countOverdue(tasks: MinimalTaskRow[], now: Date): number {
  const nowIso = now.toISOString();
  return tasks.filter((t) => t.status !== "COMPLETED" && t.due_date !== null && isBefore(t.due_date, nowIso)).length;
}

export function groupByProject(
  tasks: MinimalTaskRow[],
  projects: { id: string; name: string }[]
): { label: string; count: number }[] {
  const nameById = new Map(projects.map((p) => [p.id, p.name]));
  const counts = new Map<string, number>();
  for (const t of tasks) {
    const key = t.project_id ?? "__inbox__";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const rows = [...counts.entries()].map(([key, count]) => ({
    label: key === "__inbox__" ? "Inbox" : nameById.get(key) ?? "Inbox",
    count,
  }));
  rows.sort((a, b) => b.count - a.count);
  return rows;
}

const PRIORITY_ORDER = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export function groupByPriority(
  tasks: MinimalTaskRow[]
): { label: (typeof PRIORITY_ORDER)[number]; count: number }[] {
  const counts = new Map<string, number>(PRIORITY_ORDER.map((p) => [p, 0]));
  for (const t of tasks) counts.set(t.priority, (counts.get(t.priority) ?? 0) + 1);
  return PRIORITY_ORDER.map((label) => ({ label, count: counts.get(label)! }));
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayLabel(d: Date): string {
  return `${MONTH_ABBR[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function startOfUTCDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Monday-first index, matching lib/calendar/month.ts's own mondayIndex.
function mondayIndex(d: Date): number {
  return (d.getUTCDay() + 6) % 7;
}

function startOfWeekUTC(d: Date): Date {
  const day = startOfUTCDay(d);
  day.setUTCDate(day.getUTCDate() - mondayIndex(day));
  return day;
}

export function bucketCompletionTrend(
  tasks: MinimalTaskRow[],
  period: "daily" | "weekly" | "monthly",
  now: Date
): { label: string; count: number }[] {
  const completed = tasks.filter((t) => t.completed_at !== null);

  if (period === "daily") {
    const today = startOfUTCDay(now);
    const buckets = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - (13 - i));
      return { start: d, label: dayLabel(d), count: 0 };
    });
    for (const t of completed) {
      const day = startOfUTCDay(new Date(t.completed_at!));
      const bucket = buckets.find((b) => b.start.getTime() === day.getTime());
      if (bucket) bucket.count++;
    }
    return buckets.map(({ label, count }) => ({ label, count }));
  }

  if (period === "weekly") {
    const thisWeekStart = startOfWeekUTC(now);
    const buckets = Array.from({ length: 8 }, (_, i) => {
      const d = new Date(thisWeekStart);
      d.setUTCDate(d.getUTCDate() - (7 - i) * 7);
      return { start: d, label: dayLabel(d), count: 0 };
    });
    for (const t of completed) {
      const weekStart = startOfWeekUTC(new Date(t.completed_at!));
      const bucket = buckets.find((b) => b.start.getTime() === weekStart.getTime());
      if (bucket) bucket.count++;
    }
    return buckets.map(({ label, count }) => ({ label, count }));
  }

  // monthly
  const buckets = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - i), 1));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth(), label: `${MONTH_ABBR[d.getUTCMonth()]} ${d.getUTCFullYear()}`, count: 0 };
  });
  for (const t of completed) {
    const d = new Date(t.completed_at!);
    const bucket = buckets.find((b) => b.year === d.getUTCFullYear() && b.month === d.getUTCMonth());
    if (bucket) bucket.count++;
  }
  return buckets.map(({ label, count }) => ({ label, count }));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- lib/analytics/aggregate.test.ts`
Expected: PASS (18 tests).

- [ ] **Step 5: Lint + typecheck + full unit suite**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/analytics/aggregate.ts lib/analytics/aggregate.test.ts
git commit -m "FLOWDO-4.1 FLOWDO-4.2 FLOWDO-4.3: add pure analytics aggregation functions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```

---

## Task D2: `getAnalyticsSnapshot` data layer

**Files:**
- Create: `lib/analytics/analytics.ts`
- Test: `tests/integration/analytics.test.ts`

**Interfaces:**
- Consumes: `MinimalTaskRow` (Task D1).
- Produces: `getAnalyticsSnapshot(supabase)` (see judgment call below).

**Judgment call:** the work item's suggested signature was `getAnalyticsSnapshot(supabase, userId)` with an explicit `.eq("user_id", userId)` filter. Grepping `lib/` shows zero existing functions do this (`listTasks`, `listProjects`, `listLabels` all rely on RLS alone) — matching that actual convention means dropping the redundant `userId` parameter entirely rather than adding an unused one. `tasks_select_own` RLS (broadened further in Wave E) is what scopes this query.

- [ ] **Step 1: Write the failing integration test**

`tests/integration/analytics.test.ts`:
```ts
import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient } from "../helpers/admin-client";
import { createConfirmedTestUser } from "../helpers/test-user";
import { createTask, completeTask } from "@/lib/tasks/tasks";
import { createProject } from "@/lib/projects/projects";
import { getAnalyticsSnapshot } from "@/lib/analytics/analytics";

const admin = createAdminClient();
const createdUserIds: string[] = [];
afterEach(async () => {
  for (const id of createdUserIds.splice(0)) await admin.auth.admin.deleteUser(id);
});

describe("getAnalyticsSnapshot", () => {
  it("returns exactly the minimal shape for the caller's own top-level tasks", async () => {
    const owner = await createConfirmedTestUser(admin, "analytics-snapshot@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const { data: project } = await createProject(owner.client, owner.userId, {
      name: "Launch",
      color: "#4F46E5",
      icon: "folder",
    });
    const { data: t1 } = await createTask(owner.client, owner.userId, {
      title: "A",
      priority: "URGENT",
      projectId: project!.id,
      dueDate: "2026-01-01T00:00:00.000Z",
    });
    await completeTask(owner.client, t1!.id);
    const { data: t2 } = await createTask(owner.client, owner.userId, { title: "B", priority: "LOW" });
    await createTask(owner.client, owner.userId, { title: "Sub", parentTaskId: t2!.id });

    const { data, error } = await getAnalyticsSnapshot(owner.client);
    expect(error).toBeNull();
    // The subtask (parent_task_id set) is excluded; t1 + t2 are the only top-level rows.
    expect(data).toHaveLength(2);

    const byId = new Map(data!.map((r) => [r.id, r]));
    expect(byId.get(t1!.id)).toMatchObject({
      status: "COMPLETED",
      priority: "URGENT",
      project_id: project!.id,
      due_date: "2026-01-01T00:00:00.000Z",
    });
    expect(byId.get(t1!.id)!.completed_at).not.toBeNull();
    expect(byId.get(t2!.id)).toMatchObject({
      status: "TODO",
      priority: "LOW",
      project_id: null,
      due_date: null,
      completed_at: null,
    });
  });

  it("does not return another user's tasks (RLS)", async () => {
    const owner = await createConfirmedTestUser(admin, "analytics-rls-owner@example.com", "Password123!");
    const stranger = await createConfirmedTestUser(admin, "analytics-rls-stranger@example.com", "Password123!");
    createdUserIds.push(owner.userId, stranger.userId);
    await createTask(owner.client, owner.userId, { title: "Private" });

    const { data } = await getAnalyticsSnapshot(stranger.client);
    expect(data).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:integration -- tests/integration/analytics.test.ts`
Expected: FAIL — `getAnalyticsSnapshot` is not exported / module not found.

- [ ] **Step 3: Implement `lib/analytics/analytics.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { MinimalTaskRow } from "./aggregate";

type Client = SupabaseClient<Database, "flowdo">;

// Every other lib/ query function in this codebase (listTasks, listProjects,
// listLabels, ...) relies on RLS alone for authorization and never adds a
// redundant client-supplied `.eq("user_id", ...)` on top of it. This matches
// that convention: tasks_select_own is what actually scopes this query to
// the caller's own tasks (and, from Wave E onward, tasks in projects they're
// a member of).
export async function getAnalyticsSnapshot(supabase: Client) {
  const { data, error } = await supabase
    .from("tasks")
    .select("id,status,priority,project_id,due_date,completed_at")
    .is("parent_task_id", null);
  if (error) return { data: null, error: "Couldn't load analytics. Please try again." };
  return { data: data as MinimalTaskRow[], error: null };
}
```

- [ ] **Step 4: Run the integration test**

Run: `npm run test:integration -- tests/integration/analytics.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Lint + typecheck + unit suite**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/analytics/analytics.ts tests/integration/analytics.test.ts
git commit -m "FLOWDO-4.1: add getAnalyticsSnapshot data layer

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```

---

## Task D3: Stat tiles

**Files:**
- Create: `components/analytics/stat-tiles.tsx`, `components/analytics/stat-tiles.test.tsx`

**Interfaces:**
- Consumes: nothing beyond plain numbers (props already computed by the caller via Task D1's functions).
- Produces: `<StatTiles created completed completionRate overdue />` (signature above).

- [ ] **Step 1: Write the failing component test**

`components/analytics/stat-tiles.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatTiles } from "./stat-tiles";

describe("StatTiles", () => {
  it("renders all four values", () => {
    render(<StatTiles created={10} completed={4} completionRate={40} overdue={2} />);
    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Completion rate")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("applies destructive styling to the overdue tile only when it's > 0", () => {
    render(<StatTiles created={10} completed={4} completionRate={40} overdue={0} />);
    expect(screen.getByText("0")).not.toHaveClass("text-destructive");
  });

  it("applies destructive styling when overdue is > 0", () => {
    render(<StatTiles created={10} completed={4} completionRate={40} overdue={3} />);
    expect(screen.getByText("3")).toHaveClass("text-destructive");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- components/analytics/stat-tiles.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `components/analytics/stat-tiles.tsx`**

```tsx
export function StatTiles({
  created,
  completed,
  completionRate,
  overdue,
}: {
  created: number;
  completed: number;
  completionRate: number;
  overdue: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="space-y-1 rounded-lg border border-border p-4">
        <p className="text-xs text-muted-foreground">Created</p>
        <p className="text-2xl font-semibold">{created}</p>
      </div>
      <div className="space-y-1 rounded-lg border border-border p-4">
        <p className="text-xs text-muted-foreground">Completed</p>
        <p className="text-2xl font-semibold">{completed}</p>
      </div>
      <div className="space-y-1 rounded-lg border border-border p-4">
        <p className="text-xs text-muted-foreground">Completion rate</p>
        <p className="text-2xl font-semibold">{completionRate}%</p>
      </div>
      <div className="space-y-1 rounded-lg border border-border p-4">
        <p className="text-xs text-muted-foreground">Overdue</p>
        <p className={"text-2xl font-semibold" + (overdue > 0 ? " text-destructive" : "")}>{overdue}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- components/analytics/stat-tiles.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Lint + typecheck + unit suite**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add components/analytics/stat-tiles.tsx components/analytics/stat-tiles.test.tsx
git commit -m "FLOWDO-4.1 FLOWDO-4.2: add analytics stat tiles

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```

---

## Task D4: Reusable bar chart

**Files:**
- Create: `components/analytics/bar-chart.tsx`, `components/analytics/bar-chart.test.tsx`

**Interfaces:**
- Consumes: `groupByProject`/`groupByPriority` output shape `{label, count}[]` (Task D1).
- Produces: `<BarChart data title />` (signature above) — reused unmodified by both the by-project and by-priority charts (Task D5) and the trend chart (Task D5).

- [ ] **Step 1: Write the failing component test**

`components/analytics/bar-chart.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BarChart } from "./bar-chart";

describe("BarChart", () => {
  it("renders each row's label and count, with bar widths proportional to the max", () => {
    render(
      <BarChart
        title="By project"
        data={[
          { label: "Inbox", count: 4 },
          { label: "Launch", count: 2 },
        ]}
      />
    );
    expect(screen.getByText("By project")).toBeInTheDocument();
    expect(screen.getByText("Inbox")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Launch")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    const bars = document.querySelectorAll(".bg-primary");
    expect((bars[0] as HTMLElement).style.width).toBe("100%");
    expect((bars[1] as HTMLElement).style.width).toBe("50%");
  });

  it("shows an empty state when data is empty", () => {
    render(<BarChart title="By project" data={[]} />);
    expect(screen.getByText("No data yet")).toBeInTheDocument();
  });

  it("shows an empty state when every count is zero", () => {
    render(
      <BarChart
        title="By priority"
        data={[
          { label: "LOW", count: 0 },
          { label: "HIGH", count: 0 },
        ]}
      />
    );
    expect(screen.getByText("No data yet")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- components/analytics/bar-chart.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `components/analytics/bar-chart.tsx`**

```tsx
export function BarChart({ data, title }: { data: { label: string; count: number }[]; title: string }) {
  const max = Math.max(0, ...data.map((d) => d.count));
  const hasData = data.length > 0 && max > 0;

  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      {!hasData ? (
        <p className="text-xs text-muted-foreground">No data yet</p>
      ) : (
        <ul className="space-y-2">
          {data.map((row) => (
            <li key={row.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span>{row.label}</span>
                <span className="text-muted-foreground">{row.count}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${Math.round((row.count / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- components/analytics/bar-chart.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Lint + typecheck + unit suite**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add components/analytics/bar-chart.tsx components/analytics/bar-chart.test.tsx
git commit -m "FLOWDO-4.4 FLOWDO-4.5: add reusable hand-rolled bar chart

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```

---

## Task D5: Trend chart + full analytics page wiring

**Files:**
- Create: `components/analytics/trend-chart.tsx`, `components/analytics/trend-chart.test.tsx`
- Modify: `app/app/analytics/page.tsx` (replace the stub entirely)

**Interfaces:**
- Consumes: `getAnalyticsSnapshot` (D2), `listProjects` (existing), `countByStatus`/`completionRate`/`countOverdue`/`groupByProject`/`groupByPriority`/`bucketCompletionTrend` (D1), `StatTiles` (D3), `BarChart` (D4).
- Produces: `<TrendChart data period />` (signature above); the rebuilt `AnalyticsPage`.

- [ ] **Step 1: Write the failing component test**

`components/analytics/trend-chart.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrendChart } from "./trend-chart";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: (...a: unknown[]) => push(...a) }),
  useSearchParams: () => new URLSearchParams("period=daily"),
}));

describe("TrendChart", () => {
  it("marks the active period", () => {
    render(<TrendChart period="daily" data={[{ label: "Mar 1", count: 2 }]} />);
    expect(screen.getByRole("link", { name: "daily" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "weekly" })).not.toHaveAttribute("aria-current");
  });

  it("clicking a period link navigates with ?period=", () => {
    render(<TrendChart period="daily" data={[]} />);
    screen.getByRole("link", { name: "weekly" }).click();
    expect(push).toHaveBeenCalledWith("?period=weekly");
  });

  it("renders the underlying bar chart data", () => {
    render(<TrendChart period="daily" data={[{ label: "Mar 1", count: 2 }]} />);
    expect(screen.getByText("Mar 1")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- components/analytics/trend-chart.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `components/analytics/trend-chart.tsx`**

```tsx
"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { BarChart } from "./bar-chart";

const PERIODS = ["daily", "weekly", "monthly"] as const;
type Period = (typeof PERIODS)[number];

export function TrendChart({ data, period }: { data: { label: string; count: number }[]; period: Period }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function linkFor(p: Period): string {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", p);
    return `?${params.toString()}`;
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end gap-1">
        {PERIODS.map((p) => (
          <a
            key={p}
            href={linkFor(p)}
            onClick={(e) => {
              e.preventDefault();
              router.push(linkFor(p));
            }}
            aria-current={p === period ? "true" : undefined}
            className={
              "rounded-md px-2 py-1 text-xs capitalize " +
              (p === period ? "bg-primary text-primary-foreground" : "border border-border")
            }
          >
            {p}
          </a>
        ))}
      </div>
      <BarChart title="Completion trend" data={data} />
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- components/analytics/trend-chart.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Rebuild `app/app/analytics/page.tsx`**

Replace the file entirely:
```tsx
import { createClient } from "@/lib/supabase/server";
import { getAnalyticsSnapshot } from "@/lib/analytics/analytics";
import { listProjects } from "@/lib/projects/projects";
import {
  countByStatus,
  completionRate,
  countOverdue,
  groupByProject,
  groupByPriority,
  bucketCompletionTrend,
} from "@/lib/analytics/aggregate";
import { StatTiles } from "@/components/analytics/stat-tiles";
import { BarChart } from "@/components/analytics/bar-chart";
import { TrendChart } from "@/components/analytics/trend-chart";

const PERIODS = ["daily", "weekly", "monthly"] as const;
type Period = (typeof PERIODS)[number];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const supabase = await createClient();
  const [{ data: tasks }, { data: projects }] = await Promise.all([
    getAnalyticsSnapshot(supabase),
    listProjects(supabase, { includeArchived: true }),
  ]);

  const rows = tasks ?? [];
  const now = new Date();
  const { created, completed } = countByStatus(rows);
  const rate = completionRate(created, completed);
  const overdue = countOverdue(rows, now);
  const byProject = groupByProject(rows, projects ?? []);
  const byPriority = groupByPriority(rows);

  const periodParam = Array.isArray(searchParams.period) ? searchParams.period[0] : searchParams.period;
  const period: Period = (PERIODS as readonly string[]).includes(periodParam ?? "")
    ? (periodParam as Period)
    : "daily";
  const trend = bucketCompletionTrend(rows, period, now);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Analytics</h1>
      <StatTiles created={created} completed={completed} completionRate={rate} overdue={overdue} />
      <div className="grid gap-4 md:grid-cols-2">
        <BarChart title="Tasks by project" data={byProject} />
        <BarChart title="Tasks by priority" data={byPriority} />
      </div>
      <TrendChart period={period} data={trend} />
    </div>
  );
}
```

- [ ] **Step 6: Full lint + typecheck + unit + build**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: all PASS.

- [ ] **Step 7: Manual check**

`npm run dev` → sign in with a user who has a mix of tasks (some completed, some overdue, some in projects, varied priorities) → visit `/app/analytics` → confirm the four tiles show sensible numbers, both bar charts render bars proportional to their max, and clicking Daily/Weekly/Monthly changes the trend chart and the URL's `?period=`.

- [ ] **Step 8: Commit**

```bash
git add components/analytics/trend-chart.tsx components/analytics/trend-chart.test.tsx app/app/analytics/page.tsx
git commit -m "FLOWDO-4.6: wire analytics page with stat tiles, breakdowns, and trend chart

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```

---

## Task D6: Wave D checkpoint

**Files:** none (verification only).

- [ ] **Step 1: Full verification suite**

Run: `npm run lint && npm run typecheck && npm test && npm run test:integration && npm run build`
Expected: all green.

- [ ] **Step 2: Manual smoke test**

Sign in as a user with a realistic mix of tasks (multiple projects, priorities, some completed at different times over the last two months, a couple overdue). Visit `/app/analytics`: confirm the four stat tiles, both breakdown bar charts, and the trend chart all render sensibly; toggle Daily/Weekly/Monthly and confirm the chart and URL both update; confirm the empty state ("No data yet") shows correctly for a brand-new user with zero tasks.

- [ ] **Step 3: Commit anything uncommitted**

```bash
git add -A && git commit -m "FLOWDO-4.1 FLOWDO-4.2 FLOWDO-4.3 FLOWDO-4.4 FLOWDO-4.5 FLOWDO-4.6: Wave D verification pass

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3" --allow-empty
```

---

# WAVE E — Project Members & Roles (FLOWDO-4.7 through FLOWDO-4.9)

## Task E1: Migration `0012` — role management + the RLS consequences it requires

**Files:**
- Create: `supabase/migrations/0012_project_member_roles_and_task_access.sql`, `tests/integration/phase4-migrations.test.ts`
- Modify: `types/database.ts` (add `project_members` table type + `Functions.find_user_id_by_email`, folded into this task per Phase 3's own precedent of combining a migration with its type edit in one task)

**Interfaces:**
- Produces: `project_members_update_admin` policy; project-member-aware `tasks_select_own`/`tasks_insert_own`/`tasks_update_own`/`tasks_delete_own`; `profiles_select_project_mate` policy; `flowdo.find_user_id_by_email(_email text) returns uuid` RPC; `Database["flowdo"]["Tables"]["project_members"]`.

**Why this migration has four changes, not two:** the work item only names two ("add the missing UPDATE policy" and "make tasks project-member-aware"), but while designing Task E2's data layer it became clear the member list and invite features are non-functional without two more. All four are documented together here rather than silently assumed, mirroring the same "necessary scope, not scope creep" reasoning migration `0011` already used in this codebase:

1. `project_members` had no UPDATE policy — an admin/owner could invite (`project_members_insert_admin`) and remove (`project_members_delete_admin`) a member but never change an existing member's role.
2. `tasks_select_own`/`tasks_insert_own`/`tasks_update_own`/`tasks_delete_own` only ever checked `user_id = auth.uid()`, blind to project membership entirely. Without this, joining a project as a member would grant zero visibility into or control over that project's tasks — "project members" would be a hollow feature. Broadened via the existing `is_project_member`/`is_project_admin` helpers: SELECT for any member (any role, including VIEWER — a viewer should still see the project's tasks); INSERT/UPDATE for MEMBER/ADMIN/OWNER only (a VIEWER is read-only by definition and must not be able to create or edit tasks — checked directly against `project_members.role`, since neither helper exposes a "member-or-above" tier); DELETE for OWNER/ADMIN only.
3. `profiles_select_own` only ever allowed `id = auth.uid()`. The member list (Task E3) needs to show *other* members' names/emails, which that policy refuses outright. The project **owner has no `project_members` row at all** — ownership is tracked solely via `projects.owner_id` (a deliberate existing invariant; see `tests/integration/rls.test.ts`'s "project_members recursion guard" test, which explicitly documents "the owner is never auto-inserted into project_members" and inserts directly into the `projects` table, so this migration does not change that behavior) — so the new policy has to be phrased in terms of both `project_members` rows and `projects.owner_id`, not `project_members` alone. This does **not** open `profiles` to every authenticated user: unrelated users still can't see each other (verified by a still-passing pre-existing test), only people who share a project can.
4. `inviteMemberByEmail` (Task E2) needs to find a FlowDo account by an arbitrary email *before* that person is a project mate — by definition, (3)'s policy can't help there, since they don't share a project yet. Rather than widening `profiles` SELECT further, this exposes only the minimum fact needed ("does an account with this email exist, and what's its id") through a `SECURITY DEFINER` function. This looks nearly identical to `is_project_member`/`is_project_admin` but is a materially different risk shape: those two hardcode `auth.uid()`, so an anonymous caller always gets `false` and learns nothing; this one takes an arbitrary caller-supplied email with no identity check at all. Left executable by `PUBLIC` (the Postgres default), an unauthenticated caller could enumerate which emails have FlowDo accounts — so it's explicitly revoked from `PUBLIC` and granted to `authenticated` only.

- [ ] **Step 1: Confirm `0012` is the next free migration number**

Run: `ls supabase/migrations/`
Expected: the highest existing file is `0011_activity_logs_visible_after_actor_deleted.sql` — `0012` is free.

- [ ] **Step 2: Write the failing tests first**

`tests/integration/phase4-migrations.test.ts`:
```ts
import { describe, it, expect, afterAll } from "vitest";
import { queryLocalDb } from "../helpers/pg-client";

const OWNER_ID = "00000000-0000-4000-8000-000000000101";
const ADMIN_ID = "00000000-0000-4000-8000-000000000102";
const MEMBER_ID = "00000000-0000-4000-8000-000000000103";
const OUTSIDER_ID = "00000000-0000-4000-8000-000000000104";
const PROFILE_OWNER_ID = "00000000-0000-4000-8000-000000000201";
const PROFILE_MEMBER_ID = "00000000-0000-4000-8000-000000000202";
const PROFILE_STRANGER_ID = "00000000-0000-4000-8000-000000000203";
const LOOKUP_ID = "00000000-0000-4000-8000-000000000210";

async function asUser(userId: string, sql: string) {
  const results = (await queryLocalDb(
    `set local role authenticated;
     select set_config('request.jwt.claim.sub', '${userId}', true);
     ${sql}`
  )) as unknown as { rows: Record<string, unknown>[] }[];
  return results[results.length - 1]!;
}

describe("phase 4 migrations", () => {
  afterAll(async () => {
    await queryLocalDb(`delete from auth.users where id in ($1,$2,$3,$4,$5,$6,$7,$8)`, [
      OWNER_ID, ADMIN_ID, MEMBER_ID, OUTSIDER_ID,
      PROFILE_OWNER_ID, PROFILE_MEMBER_ID, PROFILE_STRANGER_ID, LOOKUP_ID,
    ]);
  });

  it("0012: project_members_update_admin lets an owner or admin change a member's role, but not a plain member", async () => {
    await queryLocalDb(`delete from auth.users where id in ($1,$2,$3)`, [OWNER_ID, ADMIN_ID, MEMBER_ID]);
    await queryLocalDb(
      `insert into auth.users (id, email) values
       ($1, 'phase4-owner@example.com'), ($2, 'phase4-admin@example.com'), ($3, 'phase4-member@example.com')`,
      [OWNER_ID, ADMIN_ID, MEMBER_ID]
    );
    const project = await queryLocalDb(
      `insert into flowdo.projects (owner_id, name) values ($1, 'role-update-test') returning id`,
      [OWNER_ID]
    );
    const projectId = project.rows[0]!.id;
    await queryLocalDb(
      `insert into flowdo.project_members (project_id, user_id, role) values
       ($1, $2, 'ADMIN'), ($1, $3, 'MEMBER')`,
      [projectId, ADMIN_ID, MEMBER_ID]
    );

    const asAdmin = await asUser(
      ADMIN_ID,
      `update flowdo.project_members set role = 'VIEWER' where project_id = '${projectId}' and user_id = '${MEMBER_ID}' returning role;`
    );
    expect(asAdmin.rows).toEqual([{ role: "VIEWER" }]);

    const asOwner = await asUser(
      OWNER_ID,
      `update flowdo.project_members set role = 'MEMBER' where project_id = '${projectId}' and user_id = '${ADMIN_ID}' returning role;`
    );
    expect(asOwner.rows).toEqual([{ role: "MEMBER" }]);

    const asMember = await asUser(
      MEMBER_ID,
      `update flowdo.project_members set role = 'ADMIN' where project_id = '${projectId}' and user_id = '${ADMIN_ID}' returning role;`
    );
    expect(asMember.rows).toEqual([]);
  });

  it("0012: a project member can select and insert the project's tasks; a non-member cannot", async () => {
    await queryLocalDb(`delete from auth.users where id in ($1,$2,$3)`, [OWNER_ID, MEMBER_ID, OUTSIDER_ID]);
    await queryLocalDb(
      `insert into auth.users (id, email) values
       ($1, 'phase4-owner2@example.com'), ($2, 'phase4-member2@example.com'), ($3, 'phase4-outsider@example.com')`,
      [OWNER_ID, MEMBER_ID, OUTSIDER_ID]
    );
    const project = await queryLocalDb(
      `insert into flowdo.projects (owner_id, name) values ($1, 'task-visibility-test') returning id`,
      [OWNER_ID]
    );
    const projectId = project.rows[0]!.id;
    await queryLocalDb(`insert into flowdo.project_members (project_id, user_id, role) values ($1, $2, 'MEMBER')`, [
      projectId,
      MEMBER_ID,
    ]);
    const task = await queryLocalDb(
      `insert into flowdo.tasks (user_id, project_id, title) values ($1, $2, 'owner task') returning id`,
      [OWNER_ID, projectId]
    );
    const taskId = task.rows[0]!.id;

    const memberSelect = await asUser(MEMBER_ID, `select id from flowdo.tasks where id = '${taskId}';`);
    expect(memberSelect.rows).toEqual([{ id: taskId }]);

    const outsiderSelect = await asUser(OUTSIDER_ID, `select id from flowdo.tasks where id = '${taskId}';`);
    expect(outsiderSelect.rows).toEqual([]);

    const memberInsert = await asUser(
      MEMBER_ID,
      `insert into flowdo.tasks (user_id, project_id, title) values ('${MEMBER_ID}', '${projectId}', 'member task') returning id;`
    );
    expect(memberInsert.rows).toHaveLength(1);

    await expect(
      queryLocalDb(
        `set local role authenticated;
         select set_config('request.jwt.claim.sub', '${OUTSIDER_ID}', true);
         insert into flowdo.tasks (user_id, project_id, title) values ('${OUTSIDER_ID}', '${projectId}', 'outsider task') returning id;`
      )
    ).rejects.toThrow();
  });

  it("0012: a VIEWER can see the project's tasks but cannot insert or update one", async () => {
    await queryLocalDb(`delete from auth.users where id in ($1,$2)`, [OWNER_ID, MEMBER_ID]);
    await queryLocalDb(
      `insert into auth.users (id, email) values
       ($1, 'phase4-owner3@example.com'), ($2, 'phase4-viewer@example.com')`,
      [OWNER_ID, MEMBER_ID]
    );
    const project = await queryLocalDb(
      `insert into flowdo.projects (owner_id, name) values ($1, 'viewer-readonly-test') returning id`,
      [OWNER_ID]
    );
    const projectId = project.rows[0]!.id;
    // MEMBER_ID is reused here as the VIEWER for this case -- a fresh id
    // constant isn't needed since each `it` block deletes and re-inserts
    // its own users before use.
    await queryLocalDb(`insert into flowdo.project_members (project_id, user_id, role) values ($1, $2, 'VIEWER')`, [
      projectId,
      MEMBER_ID,
    ]);
    const task = await queryLocalDb(
      `insert into flowdo.tasks (user_id, project_id, title) values ($1, $2, 'viewer can see this') returning id`,
      [OWNER_ID, projectId]
    );
    const taskId = task.rows[0]!.id;

    const viewerSelect = await asUser(MEMBER_ID, `select id from flowdo.tasks where id = '${taskId}';`);
    expect(viewerSelect.rows).toEqual([{ id: taskId }]);

    await expect(
      queryLocalDb(
        `set local role authenticated;
         select set_config('request.jwt.claim.sub', '${MEMBER_ID}', true);
         insert into flowdo.tasks (user_id, project_id, title) values ('${MEMBER_ID}', '${projectId}', 'viewer task') returning id;`
      )
    ).rejects.toThrow();

    // Unlike INSERT's WITH CHECK (which raises an error for a rejected row),
    // UPDATE's USING clause silently excludes a row RLS won't let the caller
    // touch -- it matches zero rows rather than throwing. Same shape as the
    // asMember case in the role-update test above.
    const viewerUpdate = await asUser(
      MEMBER_ID,
      `update flowdo.tasks set title = 'edited by viewer' where id = '${taskId}' returning id;`
    );
    expect(viewerUpdate.rows).toEqual([]);
  });

  it("0012: profiles_select_project_mate lets project mates see each other's profile, but not an unrelated user's", async () => {
    await queryLocalDb(`delete from auth.users where id in ($1,$2,$3)`, [
      PROFILE_OWNER_ID, PROFILE_MEMBER_ID, PROFILE_STRANGER_ID,
    ]);
    await queryLocalDb(
      `insert into auth.users (id, email) values
       ($1, 'phase4-profile-owner@example.com'), ($2, 'phase4-profile-member@example.com'), ($3, 'phase4-profile-stranger@example.com')`,
      [PROFILE_OWNER_ID, PROFILE_MEMBER_ID, PROFILE_STRANGER_ID]
    );
    const project = await queryLocalDb(
      `insert into flowdo.projects (owner_id, name) values ($1, 'profile-visibility-test') returning id`,
      [PROFILE_OWNER_ID]
    );
    const projectId = project.rows[0]!.id;
    await queryLocalDb(`insert into flowdo.project_members (project_id, user_id, role) values ($1, $2, 'MEMBER')`, [
      projectId,
      PROFILE_MEMBER_ID,
    ]);

    const memberSeesOwner = await asUser(PROFILE_MEMBER_ID, `select id from flowdo.profiles where id = '${PROFILE_OWNER_ID}';`);
    expect(memberSeesOwner.rows).toEqual([{ id: PROFILE_OWNER_ID }]);

    const ownerSeesMember = await asUser(PROFILE_OWNER_ID, `select id from flowdo.profiles where id = '${PROFILE_MEMBER_ID}';`);
    expect(ownerSeesMember.rows).toEqual([{ id: PROFILE_MEMBER_ID }]);

    const strangerSeesOwner = await asUser(PROFILE_STRANGER_ID, `select id from flowdo.profiles where id = '${PROFILE_OWNER_ID}';`);
    expect(strangerSeesOwner.rows).toEqual([]);
  });

  it("0012: find_user_id_by_email resolves an existing account and returns null otherwise", async () => {
    await queryLocalDb(`delete from auth.users where id = $1`, [LOOKUP_ID]);
    await queryLocalDb(`insert into auth.users (id, email) values ($1, 'phase4-lookup@example.com')`, [LOOKUP_ID]);

    const found = await queryLocalDb(`select flowdo.find_user_id_by_email('phase4-lookup@example.com') as id`);
    expect(found.rows[0]!.id).toBe(LOOKUP_ID);

    const missing = await queryLocalDb(`select flowdo.find_user_id_by_email('nobody-at-all@example.com') as id`);
    expect(missing.rows[0]!.id).toBeNull();
  });

  it("0012: find_user_id_by_email is not callable by the anonymous role", async () => {
    // Guards the REVOKE/GRANT in the migration -- without it, an
    // unauthenticated caller could enumerate registered emails.
    await expect(
      queryLocalDb(`set local role anon; select flowdo.find_user_id_by_email('phase4-lookup@example.com') as id;`)
    ).rejects.toThrow(/permission denied/i);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm run test:integration -- tests/integration/phase4-migrations.test.ts`
Expected: FAIL — the update-role assertions get back `[]` (no UPDATE policy exists yet), the member task-visibility assertions get back `[]` (tasks RLS is still owner-only), the VIEWER-read-only assertions get back `[]` for select too (a VIEWER isn't even a recognized case yet), the profile-visibility assertions get back `[]` (profiles RLS is still owner-only), and both RPC-related cases error (the function doesn't exist at all yet, so both "resolves an email" and "anon is denied" fail the same way).

- [ ] **Step 4: Write the migration**

`supabase/migrations/0012_project_member_roles_and_task_access.sql`:
```sql
-- Project members (FLOWDO-4.7/4.8/4.9) is not a real feature with only the
-- table + insert/select/delete policies migration 0003 already shipped.
-- Four things are needed together to make it actually work end to end:
--
-- 1. project_members had no UPDATE policy: an admin/owner could invite
--    (project_members_insert_admin) and remove (project_members_delete_admin)
--    a member, but never change an existing member's role. This adds the
--    missing policy, in the exact owner-or-admin shape already used by
--    insert/delete.
--
-- 2. tasks_select_own / tasks_insert_own / tasks_update_own / tasks_delete_own
--    (0003) only ever checked `user_id = auth.uid()`, completely blind to
--    project membership. Joining a project granted zero visibility into or
--    control over that project's tasks. Shipping "project members" without
--    this would let someone join a project but never see or touch its
--    actual content -- a deliberate, necessary scope inclusion, not scope
--    creep. Broadened via the existing is_project_member/is_project_admin
--    helpers: SELECT for any member (any role, including VIEWER -- a viewer
--    should still see the project's tasks); INSERT/UPDATE for MEMBER/ADMIN/
--    OWNER only (a VIEWER is read-only by definition, so it must NOT be able
--    to create or edit tasks -- checked directly against project_members.role
--    since neither helper exposes a "member-or-above" tier); DELETE for
--    OWNER/ADMIN only.
--
-- 3. profiles_select_own (0003) only ever allowed `id = auth.uid()`. A
--    project's member list (FLOWDO-4.9) needs to show OTHER members' names/
--    emails, which that policy flatly refuses. Note that the project OWNER
--    has no project_members row at all (tracked solely via projects.owner_id
--    -- see tests/integration/rls.test.ts's "project_members recursion
--    guard" case, a deliberate existing invariant this migration does not
--    change), so the visibility rule has to be phrased in terms of BOTH
--    project_members rows and projects.owner_id, not project_members alone.
--    This does NOT open profiles up to every authenticated user (that would
--    break the existing "prevents a user from reading another user's
--    profile row" guarantee between unrelated users) -- only to people who
--    actually share a project.
--
-- 4. inviteMemberByEmail (FLOWDO-4.7) needs to find a FlowDo account by an
--    arbitrary email BEFORE that person is a project mate -- by definition,
--    (3)'s policy cannot help, since they don't share a project yet. Rather
--    than widening profiles SELECT further, expose only the minimum needed
--    fact ("does an account with this email exist, and what's its id")
--    through a SECURITY DEFINER function.
--
--    This is NOT the same shape as 0003's is_project_member/is_project_admin,
--    despite the surface similarity -- those are safe to leave executable by
--    anyone because they hardcode auth.uid(): an anonymous caller has no
--    auth.uid(), so they always get `false` and learn nothing. This function
--    takes an arbitrary caller-supplied email with no auth.uid() check at
--    all, so leaving it open to PUBLIC/anon would let an unauthenticated
--    caller enumerate which emails have FlowDo accounts. It is explicitly
--    revoked from PUBLIC and granted to `authenticated` only below -- the
--    caller must already have a session before they can probe an email, and
--    they already know the email (they typed it into the invite dialog);
--    this reveals nothing beyond whether that specific email has an account.

create policy "project_members_update_admin" on flowdo.project_members
  for update using (
    exists (
      select 1 from flowdo.projects p
      where p.id = project_members.project_id and p.owner_id = auth.uid()
    )
    or flowdo.is_project_admin(project_id)
  ) with check (
    exists (
      select 1 from flowdo.projects p
      where p.id = project_members.project_id and p.owner_id = auth.uid()
    )
    or flowdo.is_project_admin(project_id)
  );

drop policy "tasks_select_own" on flowdo.tasks;
create policy "tasks_select_own" on flowdo.tasks
  for select using (
    user_id = auth.uid()
    or (project_id is not null and flowdo.is_project_member(project_id))
  );

-- The plain `user_id = auth.uid()` escape hatch (kept for personal,
-- project-less tasks and for the true project owner -- projects.owner_id,
-- who per the recursion-guard invariant above has no project_members row of
-- their own) must NOT extend to an arbitrary other project: without gating
-- it on project_id being null or actually owned by the caller, any
-- authenticated caller -- including a VIEWER or a total non-member -- could
-- plant a task in someone else's project just by self-assigning user_id,
-- which would silently defeat the MEMBER/ADMIN/OWNER-only restriction below.
-- (An earlier draft of this migration had exactly this bug -- caught only
-- because 2 of this task's own tests failed when actually run, not by
-- inspection. Confirmed live post-fix: an unrelated user can no longer
-- insert or move a task into a project they don't belong to.)
drop policy "tasks_insert_own" on flowdo.tasks;
create policy "tasks_insert_own" on flowdo.tasks
  for insert with check (
    (
      project_id is null
      and user_id = auth.uid()
    )
    or (
      project_id is not null
      and (
        exists (select 1 from flowdo.projects p where p.id = tasks.project_id and p.owner_id = auth.uid())
        or exists (
          select 1 from flowdo.project_members pm
          where pm.project_id = tasks.project_id and pm.user_id = auth.uid() and pm.role <> 'VIEWER'
        )
      )
    )
  );

-- USING keeps the plain user_id = auth.uid() branch unconditional: it only
-- decides which EXISTING rows are visible to update (a row you already own
-- is yours to touch regardless of project), so there's no project-attachment
-- exploit here the way there is in WITH CHECK below.
drop policy "tasks_update_own" on flowdo.tasks;
create policy "tasks_update_own" on flowdo.tasks
  for update using (
    user_id = auth.uid()
    or (
      project_id is not null
      and exists (
        select 1 from flowdo.project_members pm
        where pm.project_id = tasks.project_id and pm.user_id = auth.uid() and pm.role <> 'VIEWER'
      )
    )
  ) with check (
    (
      project_id is null
      and user_id = auth.uid()
    )
    or (
      project_id is not null
      and (
        exists (select 1 from flowdo.projects p where p.id = tasks.project_id and p.owner_id = auth.uid())
        or exists (
          select 1 from flowdo.project_members pm
          where pm.project_id = tasks.project_id and pm.user_id = auth.uid() and pm.role <> 'VIEWER'
        )
      )
    )
  );

drop policy "tasks_delete_own" on flowdo.tasks;
create policy "tasks_delete_own" on flowdo.tasks
  for delete using (
    user_id = auth.uid()
    or (project_id is not null and flowdo.is_project_admin(project_id))
  );

create policy "profiles_select_project_mate" on flowdo.profiles
  for select using (
    exists ( -- caller and target are both project_members rows of the same project
      select 1
      from flowdo.project_members mine
      join flowdo.project_members theirs on theirs.project_id = mine.project_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
    or exists ( -- caller OWNS a project the target is a member of
      select 1
      from flowdo.projects p
      join flowdo.project_members theirs on theirs.project_id = p.id
      where p.owner_id = auth.uid() and theirs.user_id = profiles.id
    )
    or exists ( -- target OWNS a project the caller is a member of
      select 1 from flowdo.projects p
      where p.owner_id = profiles.id and flowdo.is_project_member(p.id)
    )
  );

create or replace function flowdo.find_user_id_by_email(_email text)
returns uuid
language sql
security definer
stable
set search_path = flowdo, public
as $$
  select id from flowdo.profiles where email = _email;
$$;

-- Postgres functions are executable by PUBLIC by default, which under
-- Supabase includes the anon role. Restrict to authenticated so an
-- unauthenticated caller can't use this to enumerate registered emails.
revoke execute on function flowdo.find_user_id_by_email(text) from public;
grant execute on function flowdo.find_user_id_by_email(text) to authenticated;
```

- [ ] **Step 5: Apply the migration to hosted**

Run: `npx supabase db push`
Expected: `0012_project_member_roles_and_task_access.sql` applies cleanly.

- [ ] **Step 6: Add the `project_members` table type and `find_user_id_by_email` function type**

In `types/database.ts`, inside `Database["flowdo"]["Tables"]`, after `projects`, add:
```ts
      project_members: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
          created_at: string;
        };
        Insert: Partial<Database["flowdo"]["Tables"]["project_members"]["Row"]> & { project_id: string; user_id: string };
        Update: Partial<Database["flowdo"]["Tables"]["project_members"]["Row"]>;
        Relationships: [];
      };
```
And replace the `Functions: Record<string, never>;` line with:
```ts
    Functions: {
      find_user_id_by_email: {
        Args: { _email: string };
        Returns: string | null;
      };
    };
```

- [ ] **Step 7: Run the migration test to verify it passes**

Run: `npm run test:integration -- tests/integration/phase4-migrations.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 9: Run the full existing integration suite to confirm nothing broke**

Run: `npm run test:integration`
Expected: all PASS, including the pre-existing `tests/integration/rls.test.ts` cases (unrelated-user task/profile privacy, the project_members recursion guard, and the owner_id transfer guard) — none of them involve project membership on the same project as another user in a way this migration's `OR` branches would newly satisfy.

- [ ] **Step 10: Lint + unit suite**

Run: `npm run lint && npm test`
Expected: all PASS.

- [ ] **Step 11: Commit**

```bash
git add supabase/migrations/0012_project_member_roles_and_task_access.sql \
  tests/integration/phase4-migrations.test.ts types/database.ts
git commit -m "FLOWDO-4.7 FLOWDO-4.8: add project member role management and the task/profile RLS it requires

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```

---

## Task E2: Project members data layer

**Files:**
- Create: `lib/projects/members.ts`
- Test: `tests/integration/members.test.ts`

**Interfaces:**
- Consumes: `getProject` (`lib/projects/projects.ts`, existing); `project_members_select_same_project` RLS (existing, 0003) for the member-row read; `profiles_select_project_mate` + `find_user_id_by_email` (Task E1).
- Produces: `MemberWithProfile`, `listMembers`, `inviteMemberByEmail`, `updateMemberRole`, `removeMember` (signatures above).

Tagged with all three work items combined (`FLOWDO-4.7 FLOWDO-4.8 FLOWDO-4.9`) rather than split per function — `listMembers` underlies all three UI surfaces built in E3–E5, so splitting the tag by function would be misleading.

- [ ] **Step 1: Write the failing integration tests**

`tests/integration/members.test.ts`:
```ts
import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient } from "../helpers/admin-client";
import { createConfirmedTestUser } from "../helpers/test-user";
import { createProject } from "@/lib/projects/projects";
import { listMembers, inviteMemberByEmail, updateMemberRole, removeMember } from "@/lib/projects/members";

const admin = createAdminClient();
const createdUserIds: string[] = [];
afterEach(async () => {
  for (const id of createdUserIds.splice(0)) await admin.auth.admin.deleteUser(id);
});

describe("project members", () => {
  it("an owner invites an existing user by email and sees them in the member list alongside themselves", async () => {
    const owner = await createConfirmedTestUser(admin, "members-owner@example.com", "Password123!");
    const invitee = await createConfirmedTestUser(admin, "members-invitee@example.com", "Password123!");
    createdUserIds.push(owner.userId, invitee.userId);

    const { data: project } = await createProject(owner.client, owner.userId, { name: "Shared", color: "#4F46E5", icon: "folder" });
    const { data: member, error } = await inviteMemberByEmail(owner.client, project!.id, "members-invitee@example.com", "MEMBER");
    expect(error).toBeNull();
    expect(member?.user_id).toBe(invitee.userId);

    const { data: members } = await listMembers(owner.client, project!.id);
    expect(members?.map((m) => ({ user_id: m.user_id, role: m.role }))).toEqual([
      { user_id: owner.userId, role: "OWNER" },
      { user_id: invitee.userId, role: "MEMBER" },
    ]);
    expect(members?.[0]?.profile?.email).toBe("members-owner@example.com");
    expect(members?.[1]?.profile?.email).toBe("members-invitee@example.com");
  });

  it("returns a human error when the email has no FlowDo account", async () => {
    const owner = await createConfirmedTestUser(admin, "members-owner2@example.com", "Password123!");
    createdUserIds.push(owner.userId);
    const { data: project } = await createProject(owner.client, owner.userId, { name: "Solo", color: "#4F46E5", icon: "folder" });

    const { data, error } = await inviteMemberByEmail(owner.client, project!.id, "nobody@example.com", "MEMBER");
    expect(data).toBeNull();
    expect(error).toBe("No FlowDo account found with that email.");
  });

  it("a plain member cannot invite, change roles, or remove members", async () => {
    const owner = await createConfirmedTestUser(admin, "members-owner3@example.com", "Password123!");
    const member = await createConfirmedTestUser(admin, "members-member3@example.com", "Password123!");
    const target = await createConfirmedTestUser(admin, "members-target3@example.com", "Password123!");
    createdUserIds.push(owner.userId, member.userId, target.userId);

    const { data: project } = await createProject(owner.client, owner.userId, { name: "Guarded", color: "#4F46E5", icon: "folder" });
    await inviteMemberByEmail(owner.client, project!.id, "members-member3@example.com", "MEMBER");
    await inviteMemberByEmail(owner.client, project!.id, "members-target3@example.com", "VIEWER");

    const { error: inviteError } = await inviteMemberByEmail(member.client, project!.id, "members-owner3@example.com", "MEMBER");
    expect(inviteError).not.toBeNull();

    await updateMemberRole(member.client, project!.id, target.userId, "ADMIN");
    const { data: afterRoleAttempt } = await listMembers(owner.client, project!.id);
    expect(afterRoleAttempt?.find((m) => m.user_id === target.userId)?.role).toBe("VIEWER");

    await removeMember(member.client, project!.id, target.userId);
    const { data: afterRemoveAttempt } = await listMembers(owner.client, project!.id);
    expect(afterRemoveAttempt?.some((m) => m.user_id === target.userId)).toBe(true);
  });

  it("an admin can change a member's role and remove a member", async () => {
    const owner = await createConfirmedTestUser(admin, "members-owner4@example.com", "Password123!");
    const projectAdmin = await createConfirmedTestUser(admin, "members-admin4@example.com", "Password123!");
    const target = await createConfirmedTestUser(admin, "members-target4@example.com", "Password123!");
    createdUserIds.push(owner.userId, projectAdmin.userId, target.userId);

    const { data: project } = await createProject(owner.client, owner.userId, { name: "Adminable", color: "#4F46E5", icon: "folder" });
    await inviteMemberByEmail(owner.client, project!.id, "members-admin4@example.com", "ADMIN");
    await inviteMemberByEmail(owner.client, project!.id, "members-target4@example.com", "MEMBER");

    const { error: roleError } = await updateMemberRole(projectAdmin.client, project!.id, target.userId, "VIEWER");
    expect(roleError).toBeNull();
    const { data: afterRole } = await listMembers(owner.client, project!.id);
    expect(afterRole?.find((m) => m.user_id === target.userId)?.role).toBe("VIEWER");

    const { error: removeError } = await removeMember(projectAdmin.client, project!.id, target.userId);
    expect(removeError).toBeNull();
    const { data: afterRemove } = await listMembers(owner.client, project!.id);
    expect(afterRemove?.some((m) => m.user_id === target.userId)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:integration -- tests/integration/members.test.ts`
Expected: FAIL — `lib/projects/members` module not found.

- [ ] **Step 3: Implement `lib/projects/members.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getProject } from "@/lib/projects/projects";

type Client = SupabaseClient<Database, "flowdo">;
type MemberRow = Database["flowdo"]["Tables"]["project_members"]["Row"];
type ProfileRow = Database["flowdo"]["Tables"]["profiles"]["Row"];

export type MemberWithProfile = MemberRow & {
  profile: Pick<ProfileRow, "full_name" | "email" | "avatar_url"> | null;
};

// project_members.user_id and profiles.id both reference auth.users(id), but
// there's no direct foreign key between project_members and profiles for
// PostgREST to auto-embed (`.select("*, profiles(...)")` only works across a
// real FK) -- two queries + an in-memory join instead of a fragile embed
// hint that doesn't actually exist in this schema.
//
// The project owner has no project_members row (tracked solely via
// projects.owner_id -- a deliberate existing invariant, see
// tests/integration/rls.test.ts's "project_members recursion guard" case),
// so it's synthesized here as a virtual OWNER entry alongside the real rows.
export async function listMembers(supabase: Client, projectId: string) {
  const { data: project, error: projectError } = await getProject(supabase, projectId);
  if (!project) return { data: null, error: projectError ?? "Project not found." };

  const { data: members, error } = await supabase
    .from("project_members")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) return { data: null, error: "Couldn't load project members. Please try again." };

  const userIds = [project.owner_id, ...members.map((m) => m.user_id)];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .in("id", userIds);
  if (profilesError) return { data: null, error: "Couldn't load project members. Please try again." };

  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const ownerRow: MemberWithProfile = {
    id: `owner-${project.owner_id}`,
    project_id: projectId,
    user_id: project.owner_id,
    role: "OWNER",
    created_at: project.created_at,
    profile: profileById.get(project.owner_id) ?? null,
  };
  const memberRows: MemberWithProfile[] = members
    .filter((m) => m.user_id !== project.owner_id)
    .map((m) => ({ ...m, profile: profileById.get(m.user_id) ?? null }));

  return { data: [ownerRow, ...memberRows], error: null };
}

export async function inviteMemberByEmail(supabase: Client, projectId: string, email: string, role: MemberRow["role"]) {
  // No invite-token / pending-invite system exists in this schema -- only
  // users who already have a FlowDo account can be added. find_user_id_by_email
  // is a SECURITY DEFINER RPC (migration 0012) that reveals only the
  // matching account's id, not its full profile -- a direct
  // `.from("profiles").select(...).eq("email", ...)` lookup here would be
  // refused by RLS, since the invitee isn't a project mate yet.
  const { data: userId, error: lookupError } = await supabase.rpc("find_user_id_by_email", { _email: email });
  if (lookupError) return { data: null, error: "Couldn't look up that email. Please try again." };
  if (!userId) return { data: null, error: "No FlowDo account found with that email." };

  const { data, error } = await supabase
    .from("project_members")
    .insert({ project_id: projectId, user_id: userId, role })
    .select()
    .single();
  if (error) {
    return {
      data: null,
      error:
        error.code === "23505"
          ? "That person is already a member of this project."
          : "Couldn't add member. Please try again.",
    };
  }
  return { data, error: null };
}

export async function updateMemberRole(supabase: Client, projectId: string, userId: string, role: MemberRow["role"]) {
  const { error } = await supabase
    .from("project_members")
    .update({ role })
    .eq("project_id", projectId)
    .eq("user_id", userId);
  if (error) return { error: "Couldn't update that member's role. Please try again." };
  return { error: null };
}

export async function removeMember(supabase: Client, projectId: string, userId: string) {
  const { error } = await supabase.from("project_members").delete().eq("project_id", projectId).eq("user_id", userId);
  if (error) return { error: "Couldn't remove that member. Please try again." };
  return { error: null };
}
```

- [ ] **Step 4: Run the integration tests**

Run: `npm run test:integration -- tests/integration/members.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Lint + typecheck + unit suite**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/projects/members.ts tests/integration/members.test.ts
git commit -m "FLOWDO-4.7 FLOWDO-4.8 FLOWDO-4.9: add project members data layer

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```

---

## Task E3: Member list component + wiring into the project page

**Files:**
- Create: `components/projects/member-list.tsx`, `components/projects/member-list.test.tsx`
- Modify: `app/app/projects/[id]/page.tsx`

**Interfaces:**
- Consumes: `listMembers`, `MemberWithProfile` (Task E2).
- Produces: `<MemberList projectId initialMembers currentUserRole />` (display-only in this task; Tasks E4/E5 extend it).

- [ ] **Step 1: Write the failing component test**

`components/projects/member-list.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemberList } from "./member-list";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/projects/members", () => ({
  listMembers: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("MemberList", () => {
  it("shows each member's display name and role badge", () => {
    wrap(
      <MemberList
        projectId="p1"
        currentUserRole="OWNER"
        initialMembers={[
          {
            id: "owner-u1", project_id: "p1", user_id: "u1", role: "OWNER", created_at: "",
            profile: { full_name: "Ada Lovelace", email: "ada@example.com", avatar_url: null },
          },
          {
            id: "m2", project_id: "p1", user_id: "u2", role: "MEMBER", created_at: "",
            profile: { full_name: null, email: "bob@example.com", avatar_url: null },
          },
        ] as never}
      />
    );
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    expect(screen.getByText("Member")).toBeInTheDocument();
  });

  it("shows an empty state with no members", () => {
    wrap(<MemberList projectId="p1" currentUserRole="OWNER" initialMembers={[]} />);
    expect(screen.getByText("No members yet.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- components/projects/member-list.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `components/projects/member-list.tsx`**

```tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { listMembers, type MemberWithProfile } from "@/lib/projects/members";

type Role = MemberWithProfile["role"];
const ROLE_LABEL: Record<Role, string> = { OWNER: "Owner", ADMIN: "Admin", MEMBER: "Member", VIEWER: "Viewer" };

function initials(nameOrEmail: string): string {
  return nameOrEmail.trim().slice(0, 1).toUpperCase();
}

export function MemberList({
  projectId,
  initialMembers,
  currentUserRole,
}: {
  projectId: string;
  initialMembers: MemberWithProfile[];
  currentUserRole: Role;
}) {
  const supabase = createClient();
  const queryKey = ["project-members", projectId];
  const { data: members = [] } = useQuery({
    queryKey,
    queryFn: async () => (await listMembers(supabase, projectId)).data ?? [],
    initialData: initialMembers,
  });

  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <h3 className="text-sm font-medium">Members</h3>
      <ul className="space-y-2">
        {members.map((m) => {
          const display = m.profile?.full_name || m.profile?.email || m.user_id;
          return (
            <li key={m.user_id} className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                {initials(display)}
              </span>
              <span className="flex-1 truncate text-sm">{display}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {ROLE_LABEL[m.role]}
              </span>
            </li>
          );
        })}
        {members.length === 0 && <li className="text-xs text-muted-foreground">No members yet.</li>}
      </ul>
    </section>
  );
}
```

(`currentUserRole` is accepted but unused in this task's version — Tasks E4/E5 gate the invite button and role controls on it. TypeScript won't flag an unused destructured prop that's part of a documented public component signature, but if the linter does, that's expected to resolve itself once E4 reads it.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- components/projects/member-list.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire into the project page**

In `app/app/projects/[id]/page.tsx`, add the import and fetch, and render the section. Full updated file:
```tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProject, listProjects } from "@/lib/projects/projects";
import { listLabels } from "@/lib/labels/labels";
import { listTasks } from "@/lib/tasks/tasks";
import { listMembers } from "@/lib/projects/members";
import { buildFullFilters } from "@/lib/tasks/filter-params";
import { getTodayRange, isBefore } from "@/lib/tasks/date-ranges";
import { ProjectStatsHeader } from "@/components/projects/project-stats-header";
import { TaskView } from "@/components/tasks/task-view";
import { ActivityFeed } from "@/components/tasks/activity-feed";
import { MemberList } from "@/components/projects/member-list";
import { ArchiveProjectButton } from "./archive-project-button";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: project } = await getProject(supabase, params.id);
  if (!project) notFound();

  const baseFilters = { projectId: project.id, parentTaskId: null, excludeCompleted: true } as const;
  const fullFilters = buildFullFilters(baseFilters, searchParams);
  const [{ data: tasks }, { data: allTasksInProject }, { data: projects }, { data: labels }, { data: members }] =
    await Promise.all([
      listTasks(supabase, fullFilters),
      listTasks(supabase, { projectId: project.id, parentTaskId: null }),
      listProjects(supabase),
      listLabels(supabase),
      listMembers(supabase, project.id),
    ]);

  const total = allTasksInProject?.length ?? 0;
  const completed = allTasksInProject?.filter((t) => t.status === "COMPLETED").length ?? 0;
  const { start } = getTodayRange();
  const overdue =
    allTasksInProject?.filter(
      (t) => t.status !== "COMPLETED" && t.due_date && isBefore(t.due_date, start)
    ).length ?? 0;
  const currentUserRole = members?.find((m) => m.user_id === user!.id)?.role ?? "VIEWER";

  return (
    <div className="space-y-6">
      <ProjectStatsHeader
        project={project}
        total={total}
        completed={completed}
        overdue={overdue}
        actions={<ArchiveProjectButton projectId={project.id} isArchived={project.status === "ARCHIVED"} />}
      />
      <MemberList projectId={project.id} initialMembers={members ?? []} currentUserRole={currentUserRole} />
      <TaskView
        initialTasks={tasks ?? []}
        projects={projects ?? []}
        labels={labels ?? []}
        userId={user!.id}
        baseFilters={baseFilters}
        viewKey={`project-${project.id}`}
        emptyState={{
          default: { title: "No tasks in this project yet", description: "Add one above." },
          filtered: { title: "No tasks match your filters", description: "Try clearing a filter or search term." },
        }}
        enableReorder
      />
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Activity</h2>
        <ActivityFeed projectId={project.id} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Full lint + typecheck + unit + build**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: all PASS.

- [ ] **Step 7: Manual check**

`npm run dev` → open a project you own → confirm a "Members" section appears showing yourself with an "Owner" badge.

- [ ] **Step 8: Commit**

```bash
git add components/projects/member-list.tsx components/projects/member-list.test.tsx "app/app/projects/[id]/page.tsx"
git commit -m "FLOWDO-4.9: add member list to the project page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```

---

## Task E4: Invite member dialog

**Files:**
- Create: `components/projects/invite-member-dialog.tsx`, `components/projects/invite-member-dialog.test.tsx`
- Modify: `components/projects/member-list.tsx`, `components/projects/member-list.test.tsx`

**Interfaces:**
- Consumes: `inviteMemberByEmail` (Task E2).
- Produces: `<InviteMemberDialog projectId open onOpenChange />` (signature above); `MemberList` now renders an "Invite member" button + this dialog when `currentUserRole` is `OWNER` or `ADMIN`.

- [ ] **Step 1: Write the failing dialog test**

`components/projects/invite-member-dialog.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InviteMemberDialog } from "./invite-member-dialog";

const inviteMemberByEmail = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/projects/members", () => ({
  inviteMemberByEmail: (...a: unknown[]) => inviteMemberByEmail(...a),
}));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => vi.clearAllMocks());

describe("InviteMemberDialog", () => {
  it("submits the email and selected role, then closes", async () => {
    inviteMemberByEmail.mockResolvedValue({ data: { id: "m1" }, error: null });
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    wrap(<InviteMemberDialog projectId="p1" open onOpenChange={onOpenChange} />);

    await user.type(screen.getByPlaceholderText("person@example.com"), "friend@example.com");
    await user.selectOptions(screen.getByLabelText("Role"), "ADMIN");
    await user.click(screen.getByRole("button", { name: /send invite/i }));

    expect(inviteMemberByEmail).toHaveBeenCalledWith(expect.anything(), "p1", "friend@example.com", "ADMIN");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows the human error and keeps the dialog open when the email has no account", async () => {
    inviteMemberByEmail.mockResolvedValue({ data: null, error: "No FlowDo account found with that email." });
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    wrap(<InviteMemberDialog projectId="p1" open onOpenChange={onOpenChange} />);

    await user.type(screen.getByPlaceholderText("person@example.com"), "nobody@example.com");
    await user.click(screen.getByRole("button", { name: /send invite/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/no flowdo account/i);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- components/projects/invite-member-dialog.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `components/projects/invite-member-dialog.tsx`**

```tsx
"use client";
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { inviteMemberByEmail } from "@/lib/projects/members";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Database } from "@/types/database";

type MemberRole = Database["flowdo"]["Tables"]["project_members"]["Row"]["role"];

export function InviteMemberDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const supabase = createClient();
  const qc = useQueryClient();
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<MemberRole>("MEMBER");

  const invite = useMutation({
    mutationFn: () => inviteMemberByEmail(supabase, projectId, email.trim(), role),
    onSuccess: (r) => {
      if (!r.error) {
        setEmail("");
        qc.invalidateQueries({ queryKey: ["project-members", projectId] });
        onOpenChange(false);
      }
    },
  });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-lg bg-background p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">Invite a member</Dialog.Title>
            <Dialog.Close aria-label="Close">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <Input
            autoFocus
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="person@example.com"
          />
          <select
            aria-label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value as MemberRole)}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="ADMIN">Admin</option>
            <option value="MEMBER">Member</option>
            <option value="VIEWER">Viewer</option>
          </select>
          {invite.data?.error && (
            <p role="alert" className="text-xs text-destructive">
              {invite.data.error}
            </p>
          )}
          <div className="flex justify-end">
            <Button type="button" disabled={!email.trim() || invite.isPending} onClick={() => invite.mutate()}>
              Send invite
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 4: Run the dialog test**

Run: `npm test -- components/projects/invite-member-dialog.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Extend the failing `MemberList` test with invite-button visibility cases**

Replace `components/projects/member-list.test.tsx` entirely:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemberList } from "./member-list";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/projects/members", () => ({
  listMembers: vi.fn().mockResolvedValue({ data: [], error: null }),
}));
vi.mock("./invite-member-dialog", () => ({ InviteMemberDialog: () => null }));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("MemberList", () => {
  it("shows each member's display name and role badge", () => {
    wrap(
      <MemberList
        projectId="p1"
        currentUserRole="OWNER"
        initialMembers={[
          {
            id: "owner-u1", project_id: "p1", user_id: "u1", role: "OWNER", created_at: "",
            profile: { full_name: "Ada Lovelace", email: "ada@example.com", avatar_url: null },
          },
          {
            id: "m2", project_id: "p1", user_id: "u2", role: "MEMBER", created_at: "",
            profile: { full_name: null, email: "bob@example.com", avatar_url: null },
          },
        ] as never}
      />
    );
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    expect(screen.getByText("Member")).toBeInTheDocument();
  });

  it("shows an empty state with no members", () => {
    wrap(<MemberList projectId="p1" currentUserRole="OWNER" initialMembers={[]} />);
    expect(screen.getByText("No members yet.")).toBeInTheDocument();
  });

  it("shows the invite button for an OWNER", () => {
    wrap(<MemberList projectId="p1" currentUserRole="OWNER" initialMembers={[]} />);
    expect(screen.getByRole("button", { name: /invite member/i })).toBeInTheDocument();
  });

  it("shows the invite button for an ADMIN", () => {
    wrap(<MemberList projectId="p1" currentUserRole="ADMIN" initialMembers={[]} />);
    expect(screen.getByRole("button", { name: /invite member/i })).toBeInTheDocument();
  });

  it("hides the invite button for a plain MEMBER", () => {
    wrap(<MemberList projectId="p1" currentUserRole="MEMBER" initialMembers={[]} />);
    expect(screen.queryByRole("button", { name: /invite member/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run it to verify the new cases fail**

Run: `npm test -- components/projects/member-list.test.tsx`
Expected: FAIL — no "Invite member" button exists yet.

- [ ] **Step 7: Update `components/projects/member-list.tsx` to add the invite button + dialog**

Replace the file entirely:
```tsx
"use client";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { listMembers, type MemberWithProfile } from "@/lib/projects/members";
import { InviteMemberDialog } from "./invite-member-dialog";
import { Button } from "@/components/ui/button";

type Role = MemberWithProfile["role"];
const ROLE_LABEL: Record<Role, string> = { OWNER: "Owner", ADMIN: "Admin", MEMBER: "Member", VIEWER: "Viewer" };

function initials(nameOrEmail: string): string {
  return nameOrEmail.trim().slice(0, 1).toUpperCase();
}
function canManage(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function MemberList({
  projectId,
  initialMembers,
  currentUserRole,
}: {
  projectId: string;
  initialMembers: MemberWithProfile[];
  currentUserRole: Role;
}) {
  const supabase = createClient();
  const queryKey = ["project-members", projectId];
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const { data: members = [] } = useQuery({
    queryKey,
    queryFn: async () => (await listMembers(supabase, projectId)).data ?? [],
    initialData: initialMembers,
  });
  const isManager = canManage(currentUserRole);

  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Members</h3>
        {isManager && (
          <Button type="button" size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
            Invite member
          </Button>
        )}
      </div>
      <ul className="space-y-2">
        {members.map((m) => {
          const display = m.profile?.full_name || m.profile?.email || m.user_id;
          return (
            <li key={m.user_id} className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                {initials(display)}
              </span>
              <span className="flex-1 truncate text-sm">{display}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {ROLE_LABEL[m.role]}
              </span>
            </li>
          );
        })}
        {members.length === 0 && <li className="text-xs text-muted-foreground">No members yet.</li>}
      </ul>
      {isManager && <InviteMemberDialog projectId={projectId} open={inviteOpen} onOpenChange={setInviteOpen} />}
    </section>
  );
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm test -- components/projects/member-list.test.tsx components/projects/invite-member-dialog.test.tsx`
Expected: PASS (7 tests total).

- [ ] **Step 9: Lint + typecheck + unit suite**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all PASS.

- [ ] **Step 10: Manual check**

`npm run dev` → open a project you own → click "Invite member" → enter a real second test account's email → confirm they appear in the member list with the chosen role.

- [ ] **Step 11: Commit**

```bash
git add components/projects/invite-member-dialog.tsx components/projects/invite-member-dialog.test.tsx \
  components/projects/member-list.tsx components/projects/member-list.test.tsx
git commit -m "FLOWDO-4.7: add invite-by-email dialog for project admins/owners

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```

---

## Task E5: Role-change and remove controls

**Files:**
- Modify: `components/projects/member-list.tsx`, `components/projects/member-list.test.tsx`

**Interfaces:**
- Consumes: `updateMemberRole`, `removeMember` (Task E2).
- Produces: no new exports — `MemberList` now renders a role `<select>` and a "Remove" button per non-owner row when `currentUserRole` is `OWNER`/`ADMIN`.

- [ ] **Step 1: Extend the failing `MemberList` test with role-change and remove cases**

Replace `components/projects/member-list.test.tsx` entirely:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemberList } from "./member-list";

const updateMemberRole = vi.fn().mockResolvedValue({ error: null });
const removeMember = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/projects/members", () => ({
  listMembers: vi.fn().mockResolvedValue({ data: [], error: null }),
  updateMemberRole: (...a: unknown[]) => updateMemberRole(...a),
  removeMember: (...a: unknown[]) => removeMember(...a),
}));
vi.mock("./invite-member-dialog", () => ({ InviteMemberDialog: () => null }));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const bob = {
  id: "m2", project_id: "p1", user_id: "u2", role: "MEMBER", created_at: "",
  profile: { full_name: "Bob", email: "bob@example.com", avatar_url: null },
};
const ada = {
  id: "owner-u1", project_id: "p1", user_id: "u1", role: "OWNER", created_at: "",
  profile: { full_name: "Ada", email: "ada@example.com", avatar_url: null },
};

describe("MemberList", () => {
  it("shows each member's display name and role badge", () => {
    wrap(<MemberList projectId="p1" currentUserRole="MEMBER" initialMembers={[ada, bob] as never} />);
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    expect(screen.getByText("Member")).toBeInTheDocument();
  });

  it("shows an empty state with no members", () => {
    wrap(<MemberList projectId="p1" currentUserRole="OWNER" initialMembers={[]} />);
    expect(screen.getByText("No members yet.")).toBeInTheDocument();
  });

  it("shows the invite button for an OWNER or ADMIN, not a MEMBER", () => {
    wrap(<MemberList projectId="p1" currentUserRole="OWNER" initialMembers={[]} />);
    expect(screen.getByRole("button", { name: /invite member/i })).toBeInTheDocument();
  });

  it("hides the invite button for a plain MEMBER", () => {
    wrap(<MemberList projectId="p1" currentUserRole="MEMBER" initialMembers={[]} />);
    expect(screen.queryByRole("button", { name: /invite member/i })).not.toBeInTheDocument();
  });

  it("lets a manager change a member's role via the select", async () => {
    const user = userEvent.setup();
    wrap(<MemberList projectId="p1" currentUserRole="OWNER" initialMembers={[bob] as never} />);
    await user.selectOptions(screen.getByLabelText("Role for Bob"), "ADMIN");
    expect(updateMemberRole).toHaveBeenCalledWith(expect.anything(), "p1", "u2", "ADMIN");
  });

  it("lets a manager remove a member", async () => {
    const user = userEvent.setup();
    wrap(<MemberList projectId="p1" currentUserRole="OWNER" initialMembers={[bob] as never} />);
    await user.click(screen.getByRole("button", { name: "Remove Bob" }));
    expect(removeMember).toHaveBeenCalledWith(expect.anything(), "p1", "u2");
  });

  it("does not show role controls for a plain MEMBER viewer", () => {
    wrap(<MemberList projectId="p1" currentUserRole="MEMBER" initialMembers={[bob] as never} />);
    expect(screen.queryByLabelText("Role for Bob")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Bob" })).not.toBeInTheDocument();
  });

  it("never shows role controls for the OWNER row itself", () => {
    wrap(<MemberList projectId="p1" currentUserRole="OWNER" initialMembers={[ada] as never} />);
    expect(screen.queryByLabelText("Role for Ada")).not.toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify the new cases fail**

Run: `npm test -- components/projects/member-list.test.tsx`
Expected: FAIL — no role `<select>` or "Remove" button exists yet.

- [ ] **Step 3: Update `components/projects/member-list.tsx` to add role-change and remove controls**

Replace the file entirely:
```tsx
"use client";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { listMembers, updateMemberRole, removeMember, type MemberWithProfile } from "@/lib/projects/members";
import { InviteMemberDialog } from "./invite-member-dialog";
import { Button } from "@/components/ui/button";

type Role = MemberWithProfile["role"];
const ROLE_LABEL: Record<Role, string> = { OWNER: "Owner", ADMIN: "Admin", MEMBER: "Member", VIEWER: "Viewer" };
const ASSIGNABLE_ROLES: Role[] = ["ADMIN", "MEMBER", "VIEWER"];

function initials(nameOrEmail: string): string {
  return nameOrEmail.trim().slice(0, 1).toUpperCase();
}
function canManage(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function MemberList({
  projectId,
  initialMembers,
  currentUserRole,
}: {
  projectId: string;
  initialMembers: MemberWithProfile[];
  currentUserRole: Role;
}) {
  const supabase = createClient();
  const qc = useQueryClient();
  const queryKey = ["project-members", projectId];
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const { data: members = [] } = useQuery({
    queryKey,
    queryFn: async () => (await listMembers(supabase, projectId)).data ?? [],
    initialData: initialMembers,
  });
  const isManager = canManage(currentUserRole);

  const invalidate = () => qc.invalidateQueries({ queryKey });
  const changeRole = useMutation({
    mutationFn: (v: { userId: string; role: Role }) => updateMemberRole(supabase, projectId, v.userId, v.role),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (userId: string) => removeMember(supabase, projectId, userId),
    onSuccess: invalidate,
  });

  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Members</h3>
        {isManager && (
          <Button type="button" size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
            Invite member
          </Button>
        )}
      </div>
      <ul className="space-y-2">
        {members.map((m) => {
          const display = m.profile?.full_name || m.profile?.email || m.user_id;
          const canEditThisRow = isManager && m.role !== "OWNER";
          return (
            <li key={m.user_id} className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                {initials(display)}
              </span>
              <span className="flex-1 truncate text-sm">{display}</span>
              {canEditThisRow ? (
                <select
                  aria-label={`Role for ${display}`}
                  value={m.role}
                  onChange={(e) => changeRole.mutate({ userId: m.user_id, role: e.target.value as Role })}
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                >
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {ROLE_LABEL[m.role]}
                </span>
              )}
              {canEditThisRow && (
                <button
                  type="button"
                  aria-label={`Remove ${display}`}
                  onClick={() => remove.mutate(m.user_id)}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Remove
                </button>
              )}
            </li>
          );
        })}
        {members.length === 0 && <li className="text-xs text-muted-foreground">No members yet.</li>}
      </ul>
      {isManager && <InviteMemberDialog projectId={projectId} open={inviteOpen} onOpenChange={setInviteOpen} />}
    </section>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- components/projects/member-list.test.tsx`
Expected: PASS (9 tests).

- [ ] **Step 5: Lint + typecheck + unit suite**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all PASS.

- [ ] **Step 6: Manual check**

`npm run dev` → as an owner, invite a second test account → change their role via the `<select>` → confirm it persists on reload → click "Remove" → confirm they disappear from the list.

- [ ] **Step 7: Commit**

```bash
git add components/projects/member-list.tsx components/projects/member-list.test.tsx
git commit -m "FLOWDO-4.8: add role-change and remove controls to the member list

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```

---

## Task E6: Wave E checkpoint

**Files:** none (verification only).

- [ ] **Step 1: Full verification suite**

Run: `npm run lint && npm run typecheck && npm test && npm run test:integration && npm run build`
Expected: all green.

- [ ] **Step 2: Manual smoke test**

Sign in with two real test accounts. As account A: create a project, invite account B as a MEMBER, confirm B appears in the member list. As account B: open the project (RLS should now permit this via project membership), confirm you can see and create tasks in it, confirm you can NOT see an "Invite member" button or role controls (not an admin/owner). Back as account A: promote B to ADMIN, confirm B can now invite others; demote back to VIEWER, confirm B can still see tasks but the tasks RLS should now block B from updating them (a VIEWER is excluded from the MEMBER-or-above update policy). Remove B from the project; confirm B loses access to its tasks on next load.

- [ ] **Step 3: Commit anything uncommitted**

```bash
git add -A && git commit -m "FLOWDO-4.7 FLOWDO-4.8 FLOWDO-4.9: Wave E verification pass

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3" --allow-empty
```

---

# WAVE F — Realtime Collaboration (FLOWDO-4.10 through FLOWDO-4.11)

## Task F1: Migration `0013` — enable Realtime on tasks and activity_logs

**Files:**
- Create: `supabase/migrations/0013_enable_realtime_tasks_activity.sql`
- Modify: `tests/integration/phase4-migrations.test.ts` (append a verification case)

**Interfaces:**
- Produces: `flowdo.tasks` and `flowdo.activity_logs` added to the `supabase_realtime` publication.

Grepping every existing migration for "publication"/"realtime" turns up nothing — this is the first table added to Realtime in this project.

- [ ] **Step 1: Write the failing verification test**

Append to `tests/integration/phase4-migrations.test.ts`:
```ts
  it("0013: flowdo.tasks and flowdo.activity_logs are in the supabase_realtime publication", async () => {
    const rows = await queryLocalDb(
      `select tablename from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'flowdo'`
    );
    expect(rows.rows.map((r) => r.tablename).sort()).toEqual(["activity_logs", "tasks"]);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:integration -- tests/integration/phase4-migrations.test.ts`
Expected: FAIL — the publication has no `flowdo` tables yet.

- [ ] **Step 3: Write the migration**

`supabase/migrations/0013_enable_realtime_tasks_activity.sql`:
```sql
-- Neither flowdo.tasks nor flowdo.activity_logs (nor any other flowdo table)
-- has been added to the supabase_realtime publication before now -- this is
-- the first. It lets clients subscribe to postgres_changes on them
-- (CLAUDE.md §23: "shared project updates", "task changes", "project
-- activity"). Publishing a table does not bypass RLS: Realtime still
-- enforces each subscriber's own RLS policies when deciding which change
-- events that specific client actually receives. That's exactly why
-- migration 0012's project-member-aware tasks_select_own broadening matters
-- here too -- without it, a project member subscribed to flowdo.tasks would
-- never receive change events for tasks they don't personally own, even
-- though they can now read them via a normal SELECT.
alter publication supabase_realtime add table flowdo.tasks, flowdo.activity_logs;
```

- [ ] **Step 4: Apply the migration to hosted**

Run: `npx supabase db push`
Expected: applies cleanly.

- [ ] **Step 5: Run the verification test**

Run: `npm run test:integration -- tests/integration/phase4-migrations.test.ts`
Expected: PASS (5 tests total in this file).

- [ ] **Step 6: Lint + typecheck + unit suite**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0013_enable_realtime_tasks_activity.sql tests/integration/phase4-migrations.test.ts
git commit -m "FLOWDO-4.10 FLOWDO-4.11: enable Realtime on tasks and activity_logs

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```

---

## Task F2: `useRealtimeTasks` + wiring into `TaskView`

**Files:**
- Create: `lib/realtime/use-realtime-tasks.ts`, `lib/realtime/use-realtime-tasks.test.ts`
- Modify: `components/tasks/task-view.tsx`, `components/tasks/task-view.test.tsx`

**Interfaces:**
- Consumes: `createClient` (`lib/supabase/client.ts`).
- Produces: `useRealtimeTasks(projectId, onChange)` (signature above).

- [ ] **Step 1: Write the failing hook test**

`lib/realtime/use-realtime-tasks.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRealtimeTasks } from "./use-realtime-tasks";

const on = vi.fn().mockReturnThis();
const subscribe = vi.fn().mockReturnThis();
const channel = { on, subscribe };
const channelFn = vi.fn().mockReturnValue(channel);
const removeChannel = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: (...a: unknown[]) => channelFn(...a),
    removeChannel: (...a: unknown[]) => removeChannel(...a),
  }),
}));

beforeEach(() => vi.clearAllMocks());

describe("useRealtimeTasks", () => {
  it("subscribes to postgres_changes filtered by project_id when a projectId is given", () => {
    renderHook(() => useRealtimeTasks("p1", vi.fn()));
    expect(channelFn).toHaveBeenCalledWith("tasks-project-p1");
    expect(on).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "*", schema: "flowdo", table: "tasks", filter: "project_id=eq.p1" },
      expect.any(Function)
    );
    expect(subscribe).toHaveBeenCalled();
  });

  it("does not subscribe when projectId is null", () => {
    renderHook(() => useRealtimeTasks(null, vi.fn()));
    expect(channelFn).not.toHaveBeenCalled();
  });

  it("calls the latest onChange when a change event fires", () => {
    const onChange = vi.fn();
    renderHook(() => useRealtimeTasks("p1", onChange));
    const handler = on.mock.calls[0]![2] as () => void;
    act(() => handler());
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("removes the channel on unmount", () => {
    const { unmount } = renderHook(() => useRealtimeTasks("p1", vi.fn()));
    unmount();
    expect(removeChannel).toHaveBeenCalledWith(channel);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- lib/realtime/use-realtime-tasks.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/realtime/use-realtime-tasks.ts`**

```ts
"use client";
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export function useRealtimeTasks(projectId: string | null, onChange: () => void) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!projectId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`tasks-project-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "flowdo", table: "tasks", filter: `project_id=eq.${projectId}` },
        () => onChangeRef.current()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);
}
```

- [ ] **Step 4: Run the hook test**

Run: `npm test -- lib/realtime/use-realtime-tasks.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire into `TaskView`**

In `components/tasks/task-view.tsx`, add the import:
```tsx
import { useRealtimeTasks } from "@/lib/realtime/use-realtime-tasks";
```
And immediately after the `queryKey` declaration (`const queryKey = ["tasks", viewKey, fullFilters];`), add:
```tsx
  useRealtimeTasks(typeof fullFilters.projectId === "string" ? fullFilters.projectId : null, () => {
    queryClient.invalidateQueries({ queryKey: ["tasks", viewKey] });
  });
```

- [ ] **Step 6: Add a wiring test to `task-view.test.tsx`**

Add the mock near the top of `components/tasks/task-view.test.tsx` (alongside the existing mocks):
```tsx
const useRealtimeTasks = vi.fn();
vi.mock("@/lib/realtime/use-realtime-tasks", () => ({
  useRealtimeTasks: (...a: unknown[]) => useRealtimeTasks(...a),
}));
```
And append a new `describe` block at the end of the file:
```tsx
describe("TaskView realtime", () => {
  it("subscribes to realtime task changes scoped to the view's projectId", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <TaskView
          initialTasks={[]}
          projects={[]}
          labels={[]}
          userId="u1"
          baseFilters={{ projectId: "p1" }}
          viewKey="project-p1"
          emptyState={{
            default: { title: "d", description: "d" },
            filtered: { title: "f", description: "f" },
          }}
        />
      </QueryClientProvider>
    );
    expect(useRealtimeTasks).toHaveBeenCalledWith("p1", expect.any(Function));
  });

  it("passes null for a non-project-scoped view", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <TaskView
          initialTasks={[]}
          projects={[]}
          labels={[]}
          userId="u1"
          baseFilters={{}}
          viewKey="inbox"
          emptyState={{
            default: { title: "d", description: "d" },
            filtered: { title: "f", description: "f" },
          }}
        />
      </QueryClientProvider>
    );
    expect(useRealtimeTasks).toHaveBeenCalledWith(null, expect.any(Function));
  });
});
```

- [ ] **Step 7: Run the full task-view test file**

Run: `npm test -- components/tasks/task-view.test.tsx`
Expected: PASS (all existing cases plus the 2 new ones).

- [ ] **Step 8: Full lint + typecheck + unit + build**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: all PASS.

- [ ] **Step 9: Manual check**

Open the same project in two browser windows signed in as two different members. In window A, create or complete a task. Confirm window B's task list updates without a manual refresh.

- [ ] **Step 10: Commit**

```bash
git add lib/realtime/use-realtime-tasks.ts lib/realtime/use-realtime-tasks.test.ts \
  components/tasks/task-view.tsx components/tasks/task-view.test.tsx
git commit -m "FLOWDO-4.10: add realtime task subscriptions to project-scoped task views

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```

---

## Task F3: `useRealtimeActivity` + wiring into `ActivityFeed`

**Files:**
- Create: `lib/realtime/use-realtime-activity.ts`, `lib/realtime/use-realtime-activity.test.ts`
- Modify: `components/tasks/activity-feed.tsx`

**Interfaces:**
- Consumes: `createClient` (`lib/supabase/client.ts`).
- Produces: `useRealtimeActivity(projectId, onChange)` (signature above).

`ActivityFeed` is used both for a single task's activity (`taskId` prop) and a project's activity (`projectId` prop, as mounted on the project page). Realtime only makes sense for the project-level mount — CLAUDE.md §24 explicitly warns against "avoiding unnecessary realtime subscriptions", and a single task's own activity feed isn't the "shared project updates" case this phase targets. The hook is called unconditionally (hooks can't be called conditionally) but passed `null` for a task-scoped feed, matching `useRealtimeTasks`'s exact no-op-on-null convention from Task F2.

- [ ] **Step 1: Write the failing hook test**

`lib/realtime/use-realtime-activity.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRealtimeActivity } from "./use-realtime-activity";

const on = vi.fn().mockReturnThis();
const subscribe = vi.fn().mockReturnThis();
const channel = { on, subscribe };
const channelFn = vi.fn().mockReturnValue(channel);
const removeChannel = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: (...a: unknown[]) => channelFn(...a),
    removeChannel: (...a: unknown[]) => removeChannel(...a),
  }),
}));

beforeEach(() => vi.clearAllMocks());

describe("useRealtimeActivity", () => {
  it("subscribes to postgres_changes on activity_logs filtered by project_id when given", () => {
    renderHook(() => useRealtimeActivity("p1", vi.fn()));
    expect(channelFn).toHaveBeenCalledWith("activity-project-p1");
    expect(on).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "*", schema: "flowdo", table: "activity_logs", filter: "project_id=eq.p1" },
      expect.any(Function)
    );
    expect(subscribe).toHaveBeenCalled();
  });

  it("does not subscribe when projectId is null", () => {
    renderHook(() => useRealtimeActivity(null, vi.fn()));
    expect(channelFn).not.toHaveBeenCalled();
  });

  it("calls the latest onChange when a change event fires", () => {
    const onChange = vi.fn();
    renderHook(() => useRealtimeActivity("p1", onChange));
    const handler = on.mock.calls[0]![2] as () => void;
    act(() => handler());
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("removes the channel on unmount", () => {
    const { unmount } = renderHook(() => useRealtimeActivity("p1", vi.fn()));
    unmount();
    expect(removeChannel).toHaveBeenCalledWith(channel);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- lib/realtime/use-realtime-activity.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/realtime/use-realtime-activity.ts`**

```ts
"use client";
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export function useRealtimeActivity(projectId: string | null, onChange: () => void) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!projectId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`activity-project-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "flowdo", table: "activity_logs", filter: `project_id=eq.${projectId}` },
        () => onChangeRef.current()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);
}
```

- [ ] **Step 4: Run the hook test**

Run: `npm test -- lib/realtime/use-realtime-activity.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire into `ActivityFeed`**

Replace `components/tasks/activity-feed.tsx` entirely:
```tsx
"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { listActivity } from "@/lib/activity/activity";
import { describeActivity } from "@/lib/activity/format";
import { useRealtimeActivity } from "@/lib/realtime/use-realtime-activity";

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
  const queryClient = useQueryClient();
  const queryKey = ["activity", taskId ? "task" : "project", taskId ?? projectId];
  const { data: rows = [] } = useQuery({
    queryKey,
    queryFn: async () => (await listActivity(supabase, { taskId, projectId })).data ?? [],
  });

  useRealtimeActivity(taskId ? null : projectId ?? null, () => {
    queryClient.invalidateQueries({ queryKey });
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

- [ ] **Step 6: Run the existing `activity-feed.test.tsx` to confirm it still passes unmodified**

Run: `npm test -- components/tasks/activity-feed.test.tsx`
Expected: PASS — the existing test mounts `<ActivityFeed taskId="t1" />` (no `projectId`), so `useRealtimeActivity` is called with `null` and never touches the mocked `createClient()`'s missing `.channel` method.

- [ ] **Step 7: Full lint + typecheck + unit + build**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: all PASS.

- [ ] **Step 8: Manual check**

With two browser windows on the same project's page (two different signed-in members), have one member complete a task in the calendar or task list. Confirm the other window's "Activity" section updates without a manual refresh.

- [ ] **Step 9: Commit**

```bash
git add lib/realtime/use-realtime-activity.ts lib/realtime/use-realtime-activity.test.ts \
  components/tasks/activity-feed.tsx
git commit -m "FLOWDO-4.11: add realtime activity subscriptions to project activity feeds

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3"
```

---

## Task F4: Wave F checkpoint + branch finish

**Files:** none (verification + handoff).

- [ ] **Step 1: Full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run test:integration && npm run build`
Expected: all green.

- [ ] **Step 2: Full manual smoke test simulating two collaborators on a shared project**

Sign in as account A in one browser window and account B (invited as a MEMBER on one of A's projects) in another. On the project page: confirm B sees the member list, tasks, and activity feed. In A's window, create a task, complete another, and change B's role via the member list. Confirm B's window reflects the new task and completion live (Task F2/F3's realtime wiring) without a manual refresh, and that role changes take effect on B's next action (RLS is evaluated per-request, not pushed to the client — a role downgrade to VIEWER should make B's next task edit attempt silently no-op, matching Wave E's checkpoint smoke test). Visit `/app/analytics` as A and confirm the dashboard still reflects A's own tasks correctly (analytics intentionally stays scoped to the caller's own top-level tasks, not aggregated across a shared project — this phase didn't add project-scoped analytics, only per-user).

- [ ] **Step 3: Commit anything uncommitted**

```bash
git add -A && git commit -m "FLOWDO-4.10 FLOWDO-4.11: Wave F verification pass

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kYGPnRk961aRcM1Qdjx3" --allow-empty
```

- [ ] **Step 4: Code review**

Invoke `superpowers:requesting-code-review` for the whole `flowdo-phase4` branch vs `main`. Triage findings with `superpowers:receiving-code-review`, fix valid ones (each fix: test → implement → verify → commit with the relevant `FLOWDO-4.N:` prefix), re-run the full verification suite.

- [ ] **Step 5: Finish the branch**

Invoke `superpowers:finishing-a-development-branch`. Open the PR to `main`:
- Title: `FLOWDO-4: Phase 4 — analytics, project members & roles, realtime collaboration`
- Body: summarize per work item (4.1–4.11), link CLAUDE.md §22/§23, note migrations `0012`–`0013` and that they must be applied to hosted via `npx supabase db push` (already done during the plan, but call it out for anyone reviewing against a different environment), paste the final verification output.
- Footer: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

---

## Self-Review

**1. Spec coverage**

| CLAUDE.md §22 metric | Task |
|---|---|
| Tasks created | D1 `countByStatus` (created), D2, D3 |
| Tasks completed | D1 `countByStatus` (completed), D2, D3 |
| Completion rate | D1 `completionRate`, D3 |
| Overdue tasks | D1 `countOverdue`, D3 |
| Tasks by project | D1 `groupByProject`, D4, D5 |
| Tasks by priority | D1 `groupByPriority`, D4, D5 |
| Daily completion | D1 `bucketCompletionTrend("daily")`, D5 |
| Weekly completion | D1 `bucketCompletionTrend("weekly")`, D5 |
| Monthly completion | D1 `bucketCompletionTrend("monthly")`, D5 |

(CLAUDE.md §22 actually lists 9 metric lines, not 8 as initially described when this plan was commissioned — all 9 are covered above; noting the discrepancy rather than silently dropping one.)

| CLAUDE.md §23 realtime area | Task |
|---|---|
| Shared project updates | F2 + F3 together (task changes and activity both reflect a shared project live) |
| Task changes | F2 |
| Project activity | F3 |

| Kaido work item | Task |
|---|---|
| FLOWDO-4.7 (invite/add members by role) | E1 (RLS), E2 (`inviteMemberByEmail`), E4 (dialog) |
| FLOWDO-4.8 (role management) | E1 (`project_members_update_admin` + MEMBER-vs-VIEWER task UPDATE split), E2 (`updateMemberRole`), E5 (UI) |
| FLOWDO-4.9 (member list / visibility) | E1 (`profiles_select_project_mate`), E2 (`listMembers`), E3 (UI) |
| FLOWDO-4.10 (realtime task changes) | F1 (publication), F2 (hook + wiring) |
| FLOWDO-4.11 (realtime project activity) | F1 (publication), F3 (hook + wiring) |

No gaps found.

**2. Placeholder scan** — searched this plan for "TBD", "TODO", "implement later", "add appropriate error handling", "write tests for the above", and "similar to Task N". None found. Every code step contains a real, complete code block; every test has concrete assertions. The two spots that reference "the same convention as Task N" (D1 reusing `mondayIndex` from `lib/calendar/month.ts`, D2 matching `listTasks`'s no-double-filter convention) point at a real, already-read file with a concrete implementation to copy, not an unwritten placeholder.

**3. Type consistency** — checked every later-task usage against its defining task:
- `MinimalTaskRow` (D1) used identically in D2's `getAnalyticsSnapshot` return type and D5's page wiring.
- `{label, count}[]` shape produced by `groupByProject`/`groupByPriority`/`bucketCompletionTrend` (D1) consumed unchanged by `BarChart`'s `data` prop (D4) and `TrendChart`'s `data` prop (D5) — verified `BarChart` is reused as-is, not re-implemented, for both breakdowns and the trend chart.
- `MemberWithProfile` (E2) used identically in E3/E4/E5's `MemberList`/`InviteMemberDialog` props — `role` field typed as the same 4-value union throughout.
- `listMembers`'s owner-synthesis behavior (E2: the owner always appears as a virtual row with `role: "OWNER"`) is relied on by E3's `currentUserRole` computation (`members?.find(...) ?? "VIEWER"`) — if `listMembers` ever stopped synthesizing the owner, that computation would silently misclassify the owner as a VIEWER, so this dependency is called out explicitly here.
- `useRealtimeTasks`/`useRealtimeActivity` (F2/F3) share the exact same `(projectId: string | null, onChange: () => void)` signature and no-op-on-null convention, documented as a deliberate deviation from the work item's literal `projectId: string` in the "Interfaces locked by this plan" section so neither task reinvents it differently.

**4. Judgment calls the plan owner should know about:**

- **`getAnalyticsSnapshot` drops the `userId` parameter** the work item suggested, since grepping `lib/` showed zero existing functions add a redundant `.eq("user_id", ...)` alongside RLS — matching the actual codebase convention instead of the literal suggested signature.
- **Migration `0012` has four changes, not the two the work item named.** Designing `lib/projects/members.ts` (E2) surfaced that the member list and invite-by-email features are non-functional under the existing owner-only `profiles_select_own` policy — a new `profiles_select_project_mate` policy and a `find_user_id_by_email` SECURITY DEFINER RPC were added, fully justified in the migration's own comment, and verified not to break the pre-existing `tests/integration/rls.test.ts` profile-privacy test between unrelated users.
- **The project owner is never given a `project_members` row.** `tests/integration/rls.test.ts` already documents this as a deliberate invariant ("the owner is tracked via projects.owner_id and is never auto-inserted into project_members"). Rather than changing `createProject` and backfilling existing projects (which would have been a bigger, riskier diff touching a pre-existing, tested behavior), `listMembers` synthesizes a virtual OWNER row instead — the minimal change that makes the member list complete without touching project-creation semantics.
- **Wave E task numbering:** the work item's own suggested E2 (type addition) was folded into E1 alongside its migration, following Phase 3's precedent (`Task B1` did the same). This shifted every subsequent letter down by one from the work item's suggested numbering (data layer is E2, member-list UI is E3, invite dialog is E4, role/remove controls are E5, checkpoint is E6).
- **Branch strategy:** recommended and specified a dedicated `flowdo-phase4` feature branch (Task D0), created the same way Phase 3's `flowdo-4-phase3` was, for consistency — rather than committing directly to `main`.
