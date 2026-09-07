# FlowDo — Phase 3 Design: Subtasks, Labels, Calendar, Recurring Tasks, Activity, Notifications

**Status:** Approved for implementation
**Date:** 2026-09-07
**Kaido feature:** `FLOWDO-4` — work items `FLOWDO-4.1` … `FLOWDO-4.14`

## Purpose

Phases 1–2 shipped auth, the full `flowdo` schema with RLS, and task/project
CRUD with the four task views, search/filter/sort, drag-and-drop ordering,
and real dashboard widgets. Tasks are still flat: no breakdown, no
categorization, no calendar, no recurrence, no history, no reminders.

Phase 3 adds richer task organization and the productivity habit-loop
features on top of Phase 2's core CRUD, per the roadmap in `CLAUDE.md`
section 37. This is the third of five phases.

## Goals

A signed-in user can:

- break a task into subtasks, check them off, and see `3 / 5 completed` with
  a progress bar on the parent (`FLOWDO-4.1`, `FLOWDO-4.2`);
- create/edit/delete labels (name + colour), assign them to tasks, and
  filter any task list by label (`FLOWDO-4.3`, `FLOWDO-4.4`);
- see a monthly calendar of tasks by due date, create a task straight from a
  day, and open a task's detail from a calendar entry (`FLOWDO-4.5` –
  `FLOWDO-4.7`);
- set a recurrence rule on a task (Never / Daily / Weekly / Monthly / Yearly
  / Custom) and, on completing it, have the next occurrence generated
  automatically (`FLOWDO-4.8`, `FLOWDO-4.9`);
- see an activity history per task and per project, recorded automatically
  for create / update / complete / delete events (`FLOWDO-4.10`,
  `FLOWDO-4.11`);
- see in-app due-soon and overdue notifications plus a once-a-day summary,
  in a notification centre opened from a bell in the topbar with an unread
  count (`FLOWDO-4.12` – `FLOWDO-4.14`).

## Non-goals

- **No background-job infrastructure.** No `pg_cron`, no cron route, no
  worker. Notifications are *derived* (see Architecture → Notifications).
  This matches `CLAUDE.md` §21 ("Do not build a complicated notification
  infrastructure in the MVP") and §23.
- **No realtime.** The bell and activity feed refresh on navigation.
  Supabase Realtime is Phase 4.
- **No analytics** — the `/app/analytics` page stays a stub (Phase 4).
- **No project members / collaboration UI** — Phase 4. `project_members`
  RLS already exists and is untouched here.
- **No email notifications.** In-app only.
- **No full RRULE / iCalendar recurrence.** "Custom" is a single
  `{interval, unit}` rule, no by-weekday / by-month-day / count / until.
- **Recurring tasks require a due date.** A recurrence with no due date has
  nothing to advance; the form disables recurrence until a due date is set.
- **Subtasks are not shown in the flat views** (Inbox / Today / Upcoming /
  Completed) or in dashboard counts — they appear only inside their
  parent's detail panel.

## Tech stack additions

None. No new npm dependencies. Radix Dialog / Dropdown, TanStack Query,
React Hook Form + Zod, Lucide, and `@supabase/ssr` are all already present.
The calendar is built from date math, no calendar library (`CLAUDE.md`
§19).

## Data model changes

Three additive migrations, one per delivery wave (see Delivery). Each is
forward-only and safe on existing rows. `types/database.ts` is
hand-maintained in this repo (not `supabase gen types` output) — every
migration below has a matching hand-edit to that file.

### `0007_task_recurrence.sql` (Wave B)

```sql
create type flowdo.recurrence_freq as enum
  ('NEVER', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM');

alter table flowdo.tasks
  add column recurrence flowdo.recurrence_freq not null default 'NEVER',
  add column recurrence_rule jsonb;
```

- `recurrence_rule` is `null` for every frequency except `CUSTOM`, where it
  is `{"interval": <positive int>, "unit": "day"|"week"|"month"|"year"}`.
- No RLS change — these are ordinary columns on `tasks`, already covered by
  `tasks_update_own` / `tasks_insert_own`.
- A generated child occurrence copies the parent's `recurrence` and
  `recurrence_rule`, so a recurring task stays recurring across occurrences.

### `0008_activity_log_triggers.sql` (Wave C)

Adds `SECURITY DEFINER` trigger functions in the `flowdo` schema (same
idiom as `set_updated_at`, `handle_new_user`):

```sql
create or replace function flowdo.log_task_activity() returns trigger
language plpgsql security definer set search_path = flowdo, public as $$
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
      when tg_op = 'UPDATE' then jsonb_build_object('title', new.title)
      else jsonb_build_object('title', new.title)
    end
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger log_task_activity
  after insert or update or delete on flowdo.tasks
  for each row execute function flowdo.log_task_activity();
```

`flowdo.log_project_activity()` is the analogous function for
`flowdo.projects` (`project.created` / `project.updated` /
`project.archived` (on `status` → `ARCHIVED`) / `project.deleted`).

- **On DELETE, `task_id` / `project_id` is written `NULL`** and the id +
  title snapshot goes in `metadata`. `activity_logs.task_id` /
  `project_id` are `on delete set null` in the existing schema, but the
  trigger fires in the same transaction as the delete, so referencing the
  about-to-vanish row's id in the FK column would violate the constraint.
- `activity_logs` keeps its single existing policy
  `activity_logs_select_own` (`user_id = auth.uid()`). **No INSERT
  policy** — the `SECURITY DEFINER` trigger runs as the table owner and
  bypasses RLS; app code never inserts activity rows directly.
- Trigger writes are `AFTER`, so a failed task write never leaves a
  spurious activity row.

### `0009_notification_dismissals.sql` (Wave C)

```sql
alter table flowdo.notifications add column dedupe_key text;

create unique index notifications_user_dedupe_key_idx
  on flowdo.notifications (user_id, dedupe_key)
  where dedupe_key is not null;

create policy "notifications_insert_own" on flowdo.notifications
  for insert with check (user_id = auth.uid());
```

`notifications` already has `notifications_select_own`,
`notifications_update_own`, `notifications_delete_own` but **no INSERT
policy** — the client cannot currently write a row. Phase 3's derived
model only ever writes *dismissal* rows (see Architecture → Notifications),
so an own-rows INSERT policy is sufficient and safe.

### No change to

`labels`, `task_labels` (both tables + RLS exist from Phase 1 and are
correct as-is), `tasks.parent_task_id` (exists, unused until now),
`project_members`, `profiles`.

## Architecture

Phase 3 keeps every Phase 1/2 pattern: small typed functions in `lib/*`
that take a Supabase client and do one operation; Server Components for
first paint; TanStack Query for interaction; **no Next.js Server Actions**;
authorization is RLS via `auth.uid()`, never a client-supplied id; URL
search params, not component state, hold shareable view state.

### Subtasks (`FLOWDO-4.1`, `FLOWDO-4.2`)

`tasks.parent_task_id` already exists (`references flowdo.tasks(id) on
delete cascade`). A subtask is just a task with `parent_task_id` set. RLS
`tasks_*_own` already covers it (same `user_id`).

- `lib/tasks/subtasks.ts`:
  - `listSubtasks(supabase, parentId)` — `parent_task_id = parentId`,
    ordered by `position` then `created_at`.
  - `createSubtask(supabase, userId, parentId, title)` — a `tasks` insert
    with `parent_task_id = parentId`, `position: Date.now()`.
  - `subtaskProgress(rows) → { done, total }` — **pure**, `done` =
    `status === 'COMPLETED'` count. Unit-tested.
  - Toggling / deleting a subtask reuses `completeTask` / `reopenTask` /
    `deleteTask` from `lib/tasks/tasks.ts` unchanged.
- **Flat-view exclusion:** `listTasks` gains a `parentTaskId?: string |
  null` filter. Every existing base filter — Inbox, Today, Upcoming,
  Completed, project overview — sets `parentTaskId: null`.
  `computeDashboardStats` filters `t.parent_task_id === null` before its
  existing logic. The calendar also passes `parentTaskId: null`.
- **UI:** `components/tasks/subtask-section.tsx`, rendered inside the
  detail panel. Inline "add subtask" input (Enter to add), a checkbox list,
  a `3 / 5 completed` line with a `bg-primary` progress bar. Its own
  TanStack Query key `["subtasks", task.id]`; mutations invalidate that key
  and the parent task list.
- Completing a subtask does **not** roll up to the parent's status —
  progress is informational only (matches `CLAUDE.md` §17's example, which
  shows progress without auto-completion).

### Labels (`FLOWDO-4.3`, `FLOWDO-4.4`)

`labels` (`user_id, name, color`, `unique (user_id, name)`) and
`task_labels` (`task_id, label_id` PK) + their RLS all exist from Phase 1.

- `lib/labels/labels.ts`: `listLabels`, `createLabel`, `updateLabel`,
  `deleteLabel`. `color` from the same fixed 10-swatch palette projects
  use (`lib/constants/project-colors.ts`) — no free-form picker.
- `lib/tasks/task-labels.ts`:
  - `listTaskLabels(supabase, taskId)` → `label_id[]` (or joined `labels`
    rows).
  - `setTaskLabels(supabase, taskId, labelIds[])` — reads current rows,
    deletes removed, inserts added. One function, diff-based, so the
    detail panel just hands it the desired set.
- `lib/validations/tasks.ts` gains `labelSchema` (`name` trimmed non-empty,
  `color` non-empty).
- **Label filter:** `lib/tasks/filter-params.ts` parses a `label` param
  (a label id) into `labelId`. `listTasks` applies it with an embedded
  inner join: `.select("*, task_labels!inner(label_id)").eq(
  "task_labels.label_id", labelId)`. `parseFilterParams` validates the
  value is a UUID-shaped string; an unknown id simply returns no rows.
- **UI:**
  - `components/labels/manage-labels-dialog.tsx` — a Radix Dialog listing
    the user's labels with edit (name + swatch) and delete, plus an add
    row. Reused from both the label picker and the filters bar; **no
    `/app/settings/labels` route.**
  - `components/tasks/label-picker.tsx` — chip multi-select in the detail
    panel, with a "＋ New label" affordance that opens the manage dialog.
  - `components/tasks/task-filters.tsx` gains a label `<select>` populated
    from `listLabels`; changing it writes `?label=<id>` like every other
    filter.
  - `components/tasks/task-row.tsx` shows assigned label chips (small,
    colour swatch + name) — keeps `CLAUDE.md` §27: a label is text, not
    colour-only.

### Calendar (`FLOWDO-4.5` – `FLOWDO-4.7`)

- `lib/calendar/month.ts`: **pure** `buildMonthGrid(year, month) → Week[]`
  where a `Week` is 7 `{ date: "YYYY-MM-DD", inMonth: boolean }` cells,
  Monday-first, padded to full weeks. Also `monthRange(year, month) → {
  start, end }` ISO instants covering the padded grid, for the query. UTC
  math, consistent with `lib/tasks/date-ranges.ts`. Unit-tested (leap
  February, month starting on Sunday, 6-row months).
- `/app/calendar/page.tsx` becomes an async Server Component: reads
  `?month=YYYY-MM` (default: current month), fetches tasks via `listTasks`
  with `{ dueDateRange: monthRange(...), parentTaskId: null }` (new
  `dueDateRange` filter on `listTasks`, a `[start,end)` on `due_date`),
  and `listProjects` + `listLabels` for the detail panel. Passes to a
  client `month-grid.tsx`.
- `components/calendar/month-grid.tsx` (client): the grid, previous/next
  month links (`router.push("?month=…")`), a day cell showing up to 3 task
  pills (title + priority dot; "+N more" opens that day's list when over), a "＋" on hover/focus
  that opens a small create dialog with `due_date` prefilled to that day
  (calls `createTask`), and a pill click that opens the **same
  `TaskDetailPanel`** used everywhere else. Month nav is server-rendered
  and shareable, matching the filter philosophy.
- Mobile: the grid collapses to a single-column agenda list of days that
  have tasks (`CLAUDE.md` §26).

### Recurring tasks (`FLOWDO-4.8`, `FLOWDO-4.9`)

- `lib/tasks/recurrence.ts`: **pure** `nextDueDate(current: Date,
  recurrence, rule) → Date`:
  - `DAILY` +1 day, `WEEKLY` +7 days, `MONTHLY` +1 month, `YEARLY` +1 year.
  - `CUSTOM` — `+ rule.interval × rule.unit`.
  - Month/year math is calendar-based on the UTC clock time of `current`
    and **clamps to month end**: 2026-01-31 + 1 month → 2026-02-28
    (2028-01-31 + 1 month → 2028-02-29). Implemented by constructing
    `Date.UTC(y, m + n, min(day, daysInMonth(y, m + n)), …)`.
  - Returns a new `Date`; never mutates input. `NEVER` is not a valid
    input (guarded by the caller). Unit-tested for every branch + the
    month-end cases.
- `completeTask(supabase, taskId)` in `lib/tasks/tasks.ts` is extended:
  after the `status = COMPLETED` update (now `.select().single()` to get
  the row back), if `row.recurrence !== 'NEVER'` **and** `row.due_date` is
  set, it inserts a new task copying `title`, `description`, `priority`,
  `project_id`, `parent_task_id`, `recurrence`, `recurrence_rule`, with
  `due_date = nextDueDate(new Date(row.due_date), …).toISOString()`,
  `status = 'TODO'`, `completed_at = null`, `position: Date.now()`. The
  activity trigger records a `task.created` for the new occurrence
  automatically.
  - Failure to create the next occurrence does **not** roll back the
    completion; it surfaces as the function's `error` string (the task is
    still completed, the user retries or edits). Documented in the
    function.
- `components/tasks/recurrence-field.tsx` in the detail panel: a
  `<select>` (Never … Custom); choosing Custom reveals `every [number]
  [day|week|month|year ▾]`. Disabled with a hint ("Set a due date to make
  this task repeat") until `dueDate` is filled. `taskSchema` gains
  `recurrence` + `recurrenceRule` (a `z.object({ interval: z.number().int()
  .positive(), unit: z.enum([...]) }).optional().nullable()`, required iff
  `recurrence === 'CUSTOM'` via `superRefine`).
- `task-row.tsx` shows a small repeat icon when `recurrence !== 'NEVER'`.

### Activity log (`FLOWDO-4.10`, `FLOWDO-4.11`)

- Writing is entirely DB triggers (see Data model → `0008`). No app code
  writes `activity_logs`.
- `lib/activity/activity.ts`: `listActivity(supabase, { taskId?,
  projectId?, limit = 50 })` — selects from `activity_logs` filtered by
  `task_id` or `project_id`, `order by created_at desc`, `limit`. RLS
  `activity_logs_select_own` scopes to the user.
- `lib/activity/format.ts`: **pure** `describeActivity(row) → string` —
  maps `{ action, metadata }` to human copy ("Completed this task",
  "Created **Ship the API docs**", "Archived this project"). Unit-tested.
- **UI:**
  - `components/tasks/activity-feed.tsx` — read-only reverse-chron list at
    the bottom of the detail panel, each line `describeActivity(row)` +
    relative time. Own query key `["activity", "task", task.id]`.
  - The project overview page (`/app/projects/[id]`) gets an "Activity"
    section below the task list, using the same component with
    `projectId`.

### Notifications (`FLOWDO-4.12` – `FLOWDO-4.14`) — derived, no infra

The `notifications` table stores **only dismissals**. The notification
list is computed from the user's tasks + current time on each load.

- `lib/notifications/derive.ts`: **pure** `deriveNotifications(tasks,
  readKeys: Set<string>, now: Date) → DerivedNotification[]` where
  `DerivedNotification = { key, type: 'overdue'|'due-soon'|'daily-summary',
  title, message, taskId: string | null, createdAt: string }`:
  - **overdue** — one per non-completed, non-subtask task whose `due_date`
    is before today's start (`getTodayRange`). `key = "overdue:<taskId>"`.
  - **due-soon** — one per non-completed, non-subtask task due today or
    within the next 24h and not already overdue. `key =
    "due-soon:<taskId>"`.
  - **daily-summary** — exactly one, `key = "daily-summary:<YYYY-MM-DD>"`
    (today, UTC), message `"N due today · M overdue"`. Only emitted when
    `N + M > 0`.
  - Items whose `key` is in `readKeys` are dropped. Result sorted:
    overdue, then due-soon (soonest first), then summary. Unit-tested.
- `lib/notifications/notifications.ts`:
  - `listReadKeys(supabase) → string[]` — `select dedupe_key from
    notifications where dedupe_key is not null`.
  - `markRead(supabase, userId, items: DerivedNotification[])` — upserts
    one `notifications` row per item (`dedupe_key = item.key`, `type`,
    `title`, `message`, `task_id = item.taskId`, `is_read = true`) with
    `onConflict: "user_id,dedupe_key"`. Idempotent.
  - `markAllRead` — same, for the whole current derived list.
  - Old dismissal rows are harmless (a stale `due-soon:<uuid>` key just
    never matches again once the task is done/deleted). No cleanup job;
    documented as acceptable (`ponytail:` comment — "unbounded dismissal
    rows, add a monthly prune if it ever matters").
- **UI:**
  - `app/app/layout.tsx` (already an async Server Component doing
    `auth.getUser()`) adds one parallel fetch: non-completed tasks with a
    non-null `due_date` (`listTasks({ excludeCompleted: true, parentTaskId:
    null, hasDueDate: true })` — new `hasDueDate` filter) + `listReadKeys`.
    Passes both to the bell.
  - `components/notifications/notification-bell.tsx` (client): runs
    `deriveNotifications`, renders a Lucide `Bell` with an unread-count
    badge, a Radix Dropdown listing items (icon by type, title, message,
    relative time), a "Mark all read" action, and per-item click →
    `markRead([item])` then open the task (navigate to the item's view or
    open the panel). Re-derives on every navigation (layout re-runs);
    no polling, no realtime.
  - Empty state in the dropdown: "You're all caught up."

## Component / file inventory

New:

```
lib/tasks/subtasks.ts              lib/tasks/recurrence.ts
lib/labels/labels.ts               lib/tasks/task-labels.ts
lib/calendar/month.ts              lib/activity/activity.ts
lib/activity/format.ts             lib/notifications/derive.ts
lib/notifications/notifications.ts

components/tasks/subtask-section.tsx      components/tasks/label-picker.tsx
components/tasks/recurrence-field.tsx     components/tasks/activity-feed.tsx
components/labels/manage-labels-dialog.tsx
components/calendar/month-grid.tsx
components/calendar/create-task-dialog.tsx
components/notifications/notification-bell.tsx

+ a colocated *.test.ts(x) beside each new pure module / component
supabase/migrations/0007_task_recurrence.sql
supabase/migrations/0008_activity_log_triggers.sql
supabase/migrations/0009_notification_dismissals.sql
```

Modified:

```
lib/tasks/tasks.ts          (parentTaskId / labelId / dueDateRange / hasDueDate
                             filters; completeTask recurrence generation)
lib/tasks/filter-params.ts  (label param)
lib/tasks/dashboard-stats.ts(exclude subtasks)
lib/validations/tasks.ts    (recurrence fields, labelSchema)
types/database.ts           (recurrence enum + columns, dedupe_key, hand-edit)
components/tasks/task-detail-panel.tsx   (mount the four new sections; split down)
components/tasks/task-view.tsx           (pass labels through; subtask/label mutations)
components/tasks/task-row.tsx            (label chips, recurrence icon)
components/tasks/task-filters.tsx        (label filter)
app/app/layout.tsx                       (notification bell + its fetch)
app/app/calendar/page.tsx                (real implementation)
app/app/projects/[id]/page.tsx           (activity section)
app/app/inbox|today|upcoming|completed/page.tsx  (parentTaskId: null base filter)
components/dashboard/sidebar.tsx         (no change; calendar link already present)
```

The detail panel is already near its size ceiling; splitting the subtask /
label / recurrence / activity blocks into their own components (above) is
part of this phase's work, not optional cleanup. It is touched in all three
waves (subtask + label sections in A, recurrence field in B, activity feed
in C) — the Wave A split establishes the seams the later waves slot into.

## Error / loading / empty states

Every new list (subtasks, labels, activity, notifications, calendar day
cells) gets the Phase 1/2 treatment: a skeleton on slow first load, a
distinct empty state, inline `FormError` on failed mutation, never a raw
Postgres/PostgREST error. Specific cases:

- Recurrence field disabled with an explanatory hint when no due date.
- Calendar month with zero dated tasks: cells render empty, no error.
- Notification dropdown empty: "You're all caught up."
- `nextDueDate` on a task with a due date far in the past still produces
  the *next* single occurrence (not a backfill of every missed one) —
  documented, matches "generate the next occurrence" wording.

## Testing plan (TDD — test first for every pure module)

**Unit (no external deps):**

- `recurrence.nextDueDate` — each frequency, Custom intervals, Jan-31
  month-end clamp, leap-year Feb, year rollover.
- `notifications.deriveNotifications` — overdue vs due-soon boundary,
  daily-summary only when count > 0, `readKeys` filtering, subtask
  exclusion, sort order.
- `calendar.buildMonthGrid` / `monthRange` — leap Feb, month starting
  Sunday/Monday, 4/5/6-row months, padded-range instants.
- `subtasks.subtaskProgress` — 0/0, all done, partial.
- `activity.describeActivity` — every action, deleted-task metadata path.
- `dashboard-stats.computeDashboardStats` — regression: subtasks excluded
  from today/overdue counts.
- `filter-params.parseFilterParams` — `label` param accepted/rejected.

**Integration (local Supabase, Phase 1 harness):**

- Activity triggers: insert/update/complete/reopen/delete a task → exactly
  the right `activity_logs` rows, correct `action`, and delete writes
  `task_id = null` with id+title in `metadata` (no FK violation).
- Project triggers: create/update/archive/delete.
- `completeTask` on a recurring task with a due date creates one next
  occurrence with copied fields and the advanced `due_date`; a recurring
  task with **no** due date creates none; a `NEVER` task creates none.
- `setTaskLabels` adds/removes the diff; `listTasks` with `labelId` returns
  only tagged tasks; cross-user: user B cannot read or tag user A's task
  (RLS regression through the app layer).
- Notification dismissal: `markRead` upserts, is idempotent on re-run,
  and RLS blocks reading/writing another user's dismissal rows;
  `listReadKeys` returns only own keys.
- Subtask RLS: user B cannot list/create subtasks under user A's task.

**Component (jsdom + RTL):**

- `subtask-section` — add, toggle, progress bar text.
- `label-picker` — select/deselect chips, "＋ New label" opens dialog.
- `recurrence-field` — Custom reveals interval inputs; disabled without a
  due date.
- `notification-bell` — badge count from a derived list, "Mark all read"
  clears it, empty state.
- `month-grid` — renders the right number of weeks, task pills land in the
  right day, prev/next links carry the right `?month=`.

## Verification before done (each wave + final)

`npm run lint && npm run typecheck && npm test && npm run test:integration
&& npm run build` all green. Known pre-existing flake
(`tests/integration/profile.test.ts` under full-suite concurrency, per
README) is not introduced or worsened; re-run to confirm if it appears.

Manual smoke test (final): add 3 subtasks to a task and check two off
(progress shows `2 / 3`); create a "Personal" label, tag a task, filter
Inbox by it; open the calendar, page to next month and back, create a task
on the 15th from the grid, click it open; set a task to Weekly with a due
date, complete it, confirm a new one appears 7 days out and the old one is
in Completed; open the completed task's activity feed and see
created/completed entries; let a task go overdue, confirm the bell shows a
count and the overdue item, mark all read, reload, confirm it stays read.

## Delivery — branch `flowdo-4-phase3`, one PR, three commit waves

Worktree via `superpowers:using-git-worktrees`. One branch, one PR to
`main`. Implemented in waves; each wave is committed only after the full
verification suite passes, with the commit message referencing its Kaido
work-item keys (`FLOWDO-4.N:` subject prefix) so the Kaido linking pilot
picks up per-work-item engineering activity.

| Wave | Work items | Migration | Scope |
|---|---|---|---|
| **A** | `4.1 4.2 4.3 4.4` | none | subtasks + progress; labels CRUD + assignment + filter; detail-panel split |
| **B** | `4.5 4.6 4.7 4.8 4.9` | `0007` | calendar view + create-from-day + open-detail; recurrence field + `nextDueDate` + generation on complete |
| **C** | `4.10 4.11 4.12 4.13 4.14` | `0008`, `0009` | activity triggers + task/project feeds; derived notifications + dismissals + topbar bell |

After Wave C: whole-branch `superpowers:requesting-code-review`, address
findings, `superpowers:finishing-a-development-branch`, open the PR.
```
