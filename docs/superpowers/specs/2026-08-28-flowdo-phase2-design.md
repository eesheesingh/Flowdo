# FlowDo — Phase 2 Design: Task & Project Management

**Status:** Approved for implementation
**Date:** 2026-08-28

## Purpose

Phase 1 shipped auth, the full `flowdo` schema with RLS, and a dashboard
shell whose views (Dashboard, Inbox, Today, Upcoming, Completed, Projects)
all render honest empty states — there is no task or project functionality
yet. Phase 2 builds that functionality: task and project CRUD, the four
task views, search/filter/sort, drag-and-drop manual ordering, a project
overview page, and real dashboard widgets.

This is the second of five phases defined in `CLAUDE.md` section 37. The
`tasks`, `projects`, `project_members`, and `task_labels`/`labels` tables
and their RLS policies already exist from Phase 1 — this phase is
UI + application logic on top of an already-hardened data layer, not new
schema work.

## Goals

A signed-in user can create a task from any view in one keystroke (title
only), open it to fill in description/due date/priority/project, mark it
complete or reopen it, see it correctly grouped into Inbox/Today/Upcoming,
search and filter and sort any task list, manually reorder tasks by drag
and drop, create and manage projects (including archiving), see a project's
own task list and progress, and get a dashboard that actually reflects
their real data instead of a static placeholder.

## Non-goals

Subtasks, labels (assigning/filtering by them), calendar view, recurring
tasks, activity log, notifications, analytics charts, realtime
collaboration, project members/roles UI — all later phases (3 and 4) per
the roadmap. `project_members` and `task_labels` tables exist in the schema
already but get no UI or application code in this phase.

## Tech stack additions

- `@dnd-kit/core` + `@dnd-kit/sortable` — drag-and-drop reordering
- No new Supabase/RLS/auth work — Phase 1's clients, middleware, and RLS
  policies are used as-is

## Architecture

### No Server Actions, same pattern as Phase 1

Task and project mutations live in small, testable functions in
`lib/tasks/tasks.ts` and `lib/projects/projects.ts` that call the Supabase
**browser** client directly (`supabase.from("tasks").insert(...)`, etc.),
matching every `lib/auth/*.ts` function from Phase 1. Authorization is
entirely Phase 1's existing RLS — `tasks_insert_own`, `tasks_update_own`,
etc. — already reviewed and adversarially tested; this phase adds no new
authorization code, only application logic that calls through those
policies via the authenticated session.

### Server Components for initial load, TanStack Query for interaction

Each view route (`/app/today`, `/app/inbox`, `/app/upcoming`,
`/app/completed`, `/app/projects/[id]`) is an async Server Component that:
1. Reads its URL search params (`q`, `status`, `priority`, `project`,
   `sort`) via Next.js's `searchParams` prop.
2. Builds the view's base filter (e.g. Today = `due_date = today AND
   status != 'COMPLETED'`) and layers the URL params on top.
3. Fetches the initial page of tasks server-side via
   `lib/supabase/server.ts`'s client — fast first paint, no loading
   spinner on navigation.
4. Passes that initial data into a Client Component
   (`components/tasks/task-view.tsx`) that seeds a TanStack Query cache
   with it (`initialData`) and handles all subsequent mutations
   (create/edit/complete/reorder), optimistic updates, and refetches via
   the browser client.

This means a bookmarked or shared filtered URL (`/app/inbox?priority=high`)
renders correctly on first load, not only after client-side interaction —
the Server Component reads the same search params the Client Component
would.

### Task CRUD, quick-add, and detail panel

`lib/tasks/tasks.ts` exports:
- `createTask(supabase, input)` — `title` required, everything else
  optional; called by both the quick-add bar (title only) and the detail
  panel (full form).
- `updateTask(supabase, taskId, input)` — partial update.
- `deleteTask(supabase, taskId)`.
- `completeTask(supabase, taskId)` / `reopenTask(supabase, taskId)` — set
  `status` to `COMPLETED`/`TODO` and `completed_at` to `now()`/`null`.
- `listTasks(supabase, filters)` — the shared query builder every view
  calls, taking `{ projectId?, dueDate?: "today" | "upcoming" | "none",
  status?, priority?, search?, sort? }`.

**Quick-add** (`components/tasks/quick-add.tsx`): a persistent input at the
top of every task view. Enter calls `createTask` with just a title, plus
whatever context the current view implies (Today sets `due_date` to today;
a project page sets `project_id`; Inbox sets neither).

**Detail panel** (`components/tasks/task-detail-panel.tsx`): a Radix
Dialog anchored to the right edge (slide-over), opened by clicking any
task row. Full form — title, description, due date, priority, project
picker, status — built with React Hook Form + `zodResolver(taskSchema)`
from `lib/validations/tasks.ts`, matching every Phase 1 form. A checkbox
on each list row calls `completeTask`/`reopenTask` directly, without
opening the panel.

### Project CRUD and overview page

`lib/projects/projects.ts` exports `createProject`, `updateProject`,
`archiveProject` (sets `projects.status` — see Data model changes below —
rather than deleting; archived projects are hidden from the sidebar and
project pickers but their tasks keep a valid `project_id` and remain
queryable), and `listProjects(supabase, { includeArchived? })`.

`/app/projects` lists active projects as cards: name, color swatch, icon,
task count, completion percentage. "New project" opens a dialog: name,
description, a fixed 10-swatch color palette
(`lib/constants/project-colors.ts`), and a curated set of ~12 Lucide icons
to choose from (`lib/constants/project-icons.ts`) — no free-form color
picker or full icon search, matching FlowDo's minimal design direction.

`/app/projects/[id]` — the project overview page — renders a stats header
(total/completed/overdue counts, a completion-percent bar) above the same
shared task-view component every other view uses, filtered to that
project's `id`. This page fetches the project directly by `id` (not via
`listProjects()`), so an archived project's overview page still renders
correctly if navigated to directly — only the sidebar/picker listing hides
it, not the page itself. A small "Archived" badge shows on this page when
the project's status is `ARCHIVED`.

### The four views share one component

Inbox, Today, Upcoming, and Completed are the same `<TaskList>`
(`components/tasks/task-list.tsx`) with a different base filter per page:

| View | Base filter | Drag-and-drop |
|---|---|---|
| Inbox | `project_id IS NULL AND status != COMPLETED` | Yes |
| Today | `due_date = today AND status != COMPLETED` | Yes |
| Upcoming | `due_date > today AND status != COMPLETED` | Yes |
| Completed | `status = COMPLETED`, sorted by `completed_at` desc | No |
| Project overview | `project_id = :id AND status != COMPLETED` | Yes |

Completed is a historical log, not a working list, so it gets no drag
handle and ignores the `sort` param's manual-order option (it's always
`completed_at` desc).

### Search, filter, sort

`components/tasks/task-filters.tsx` reads/writes URL search params:
`q` (search — `ilike` OR across `title`/`description`, no full-text-search
infrastructure needed at this scale), `status`, `priority`, `project`
(only meaningful on Inbox/Today/Upcoming, which otherwise span all
projects), `sort` (`due_date | priority | created_at | alphabetical |
manual`). Changing a filter does a shallow `router.push` and TanStack
Query refetches with the new params.

### Drag-and-drop reordering

`@dnd-kit/sortable` wraps `<TaskList>`'s rows wherever drag-and-drop is
enabled (see table above). On drop, `lib/tasks/reorder.ts`'s pure
`calculateNewPosition(prevPosition, nextPosition)` computes the new task's
`position` as the midpoint between its new neighbors (or a fresh integer
range via `calculateNewPosition(null, firstPosition)` /
`(lastPosition, null)` at either end) — a single-row optimistic update via
TanStack Query, not a rewrite of every row's position on each reorder.
`calculateNewPosition` is a pure function, unit-tested directly with no
Supabase dependency.

### Dashboard widgets

`/app/dashboard` (currently static) gets: a greeting, today's progress
(`X of Y tasks done today`), a condensed `<TaskList>` of today's tasks, an
overdue-count callout (rendered only when > 0), and a project summary
strip (compact cards: name, color, task count). All server-fetched in the
Server Component — no per-widget client-side spinners.

## Data model changes

One additive migration, `supabase/migrations/0005_project_status.sql`:
`projects` gains a `status` column (`flowdo.project_status` enum: `ACTIVE`,
`ARCHIVED`; default `ACTIVE`) so `archiveProject` can soft-archive instead
of deleting. No RLS changes — the existing `projects_update_admin` policy
already covers updating this column since it's a normal `UPDATE`, and no
new policy is needed since archived projects still belong to the same
owner/members.

No changes to `tasks`, `labels`, `task_labels`, `project_members`,
`notifications`, or `activity_logs` — Phase 1's schema for these is already
correct for what Phase 2 needs (`tasks.position` already exists and is
unused until now).

## Error/loading/empty states

Every list gets: a skeleton while the Server Component's data is loading
(only visible on slow initial loads, not on client-side refetches, which
use TanStack Query's existing-data-stays-visible behavior), an empty state
when a view or filter combination has zero results (distinct copy for "no
tasks in this view yet" vs. "no tasks match your filters" so users don't
think an active filter is a bug), and inline `FormError` on any failed
mutation — no raw Postgres/PostgREST errors surfaced to the user, matching
Phase 1's convention.

## Testing plan

- **Unit:** `calculateNewPosition` (pure function — midpoint math, both
  edge cases), Zod schema validation (`taskSchema`, `projectSchema`), the
  filter-bar's URL-param serialization logic.
- **Integration (against local Supabase, Phase 1's harness):**
  - `createTask`/`updateTask`/`deleteTask` respect RLS ownership end to
    end through the new `lib/tasks/tasks.ts` functions (not just at the
    raw SQL layer, which Phase 1 already proved).
  - `completeTask`/`reopenTask` correctly set/clear `completed_at`.
  - `archiveProject` sets `status = ARCHIVED` and excludes the project
    from `listProjects()` by default, but its tasks remain fetchable.
  - `listTasks` filter combinations return the right rows for each view's
    base filter plus at least one additional filter/sort combination.
  - A cross-user check: user B's `listTasks`/`listProjects` never returns
    user A's rows (regression guard on top of Phase 1's RLS tests, this
    time exercised through the application layer).

## Verification before done

`npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration`,
`npm run build` all pass; manual smoke test of: quick-add a task, open its
detail panel and fill in every field, complete and reopen it, create a
project and assign the task to it, archive the project and confirm it
disappears from the sidebar/picker while the task keeps its `project_id`
and remains visible on that (now-archived) project's own overview page —
archiving never moves a task to Inbox, since Inbox's filter is
`project_id IS NULL` and archiving doesn't touch `project_id` — search for
a task by partial title, filter by priority, sort by due date,
drag-reorder two tasks in Today, confirm dashboard widgets reflect real
counts.
