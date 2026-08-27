# FlowDo — Full-Stack Productivity App

You are the lead engineer responsible for designing and building **FlowDo**, a production-quality full-stack task and productivity application.

## Product

**Name:** FlowDo
**Tagline:** Find Your Flow.

FlowDo is a modern productivity application that allows users to manage tasks, projects, deadlines, priorities, subtasks, labels, recurring tasks, notifications, and productivity analytics.

The application should feel like a polished SaaS product rather than a tutorial CRUD application.

The implementation must be production-oriented, maintainable, secure, tested, responsive, and visually polished.

---

# 1. IMPORTANT: HOW YOU SHOULD WORK

You are operating inside Claude Code.

Do NOT immediately start writing a large amount of code.

First understand the repository, environment, available skills, existing code, package manager, configuration, and project structure.

Use the installed Superpowers workflow wherever applicable.

## Required skills/workflow

Use these skills:

* `superpowers:brainstorming`
* `superpowers:dispatching-parallel-agents`
* `superpowers:executing-plans`
* `superpowers:subagent-driven-development`
* `superpowers:test-driven-development`
* `superpowers:requesting-code-review`
* `superpowers:receiving-code-review`
* `superpowers:systematic-debugging`
* `superpowers:finishing-a-development-branch`
* `superpowers:using-git-worktrees`
* `frontend-design:frontend-design`

Use the skills according to their intended purpose rather than mechanically invoking all of them.

### Preferred development lifecycle

```text
Understand
    ↓
Brainstorm / clarify architecture
    ↓
Inspect repository
    ↓
Create implementation plan
    ↓
Create isolated worktree when appropriate
    ↓
Break work into independent tasks
    ↓
Dispatch parallel agents where useful
    ↓
Implement using TDD
    ↓
Run tests
    ↓
Run lint/typecheck/build
    ↓
Request code review
    ↓
Address review findings
    ↓
Systematic debugging if anything fail
    ↓
Finish development branch
```

Do not skip verification.

---

# 2. FIRST ACTIONS

Before implementing anything:

1. Inspect the repository.
2. Identify the package manager.
3. Inspect `package.json`.
4. Inspect the existing Next.js structure.
5. Inspect existing configuration.
6. Inspect `.env.example` if present.
7. Inspect existing components.
8. Inspect existing tests.
9. Inspect Git status.
10. Determine whether this is a new application or an existing codebase.
11. Check whether Supabase is already configured.
12. Check whether authentication already exists.
13. Check whether Tailwind/shadcn/ui already exists.
14. Check whether there are existing design conventions that must be preserved.

Do not overwrite existing work blindly.

If the repository already contains implementation, adapt to it rather than rebuilding everything unnecessarily.

---

# 3. PRODUCT GOALS

FlowDo should provide:

### Authentication

* Sign up
* Login
* Logout
* Email verification
* 6-digit verification OTP
* Resend verification email
* Forgot password
* Password reset
* Google OAuth if practical
* Protected application routes
* Session persistence
* Secure authentication state

### Task Management

* Create task
* Edit task
* Delete task
* Complete task
* Reopen task
* Task status
* Priority
* Due date
* Description
* Subtasks
* Labels
* Project assignment
* Search
* Filtering
* Sorting
* Drag-and-drop ordering

### Projects

* Create project
* Edit project
* Delete/archive project
* Project overview
* Project task counts
* Project colors/icons
* Project members architecture for future collaboration

### Views

* Dashboard
* Inbox
* Today
* Upcoming
* Completed
* Calendar
* Projects
* Analytics
* Settings

### Productivity

* Recurring tasks
* Notifications
* Activity history
* Productivity statistics
* Completion rate
* Overdue tasks
* Weekly/monthly productivity

---

# 4. TECHNOLOGY STACK

Use this stack unless the existing repository requires a justified alternative.

## Frontend

* Next.js
* TypeScript
* React
* Tlwind CSS
* shadcn/ui
* Lucide icons
* TanStack Query where client-side server state is appropriate
* React Hook Form
* Zod

## Backend / Data

Use **Supabase**.

Supabase provides:

* PostgreSQL
* Authentication
* Row Level Security
* Realtime
* Storage

Do NOT introduce Prisma unless there is a compelling existing-repository reason.

Prefer the official Supabase client and SSR patterns.

## Email

Use **Resend** for transactional email delivery through Supabase's SMTP configuration.

The application must NOT implement its own password storage.

The application must NOT implement its own authentication system.

Supabase Auth owns authentication.

Resend owns email delivery.

---

# 5. SUPABASE ARCHITECTURE

Create a clean relational PostgreSQL schema.

Initial tables:

```text
profiles
projects
project_members
tasks
labels
task_labels
notifications
activity_logs
```

## profiles

Fields:

```text
id
email
full_name
avatar_url
created_at
updated_at
```

`profiles.id` should reference `auth.users.id`.

---

## projects

```text
id
name
description
color
icon
owner_id
created_at
updated_at
```

---

## project_members

```text
id
project_id
user_id
role
created_at
```

Roles:

```text
OWNER
ADMIN
MEMBER
VIEWER
```

---

## tasks

```text
id
user_id
project_id
parent_task_id

title
description

status
priority

due_date
completed_at

position

created_at
updated_at
```

Statuses:

```text
TODO
IN_PROGRESS
COMPLETED
CANCELLED
```

Priorities:

```text
LOW
MEDIUM
HIGH
URGENT
```

---

## labels

```text
id
user_id
name
color
created_at
```

---

## task_labels

```text
task_id
label_id
```

---

## notifications

```text
id
user_id
task_id
type
title
message
is_read
created_at
```

---

## activity_logs

```text
id
user_id
task_id
project_id
action
metadata
created_at
```

Use proper foreign keys, indexes, constraints, timestamps, and cascade behavior.

Do not blindly copy this schema if architectural inspection reveals a better design.

---

# 6. ROW LEVEL SECURITY

This is a critical requirement.

Enable RLS on every application table.

Users must only be able to access resources they are authorized to access.

Never trust:

```text
user_id
```

coming from the frontend.

Always derive authorization from:

```text
auth.uid()
```

Examples:

A user can only access their own tasks.

A user can access a project if they are the owner or an authorized project member.

A user can only modify labels belonging to them.

A user cannot modify another user's tasks by changing an ID in an HTTP request.

Write and test RLS policies carefully.

Include migration files for:

* tables
* indexes
* constraints
* RLS
* policies
* triggers/functions if needed

---

# 7. AUTHENTICATION

Build a complete authentication experience.

Routes:

```text
/login
/signup
/verify
/forgot-password
/reset-password
```

## Sign up

Flow:

```text
User enters:

Name
Email
Password

        ↓

Supabase Auth signup

        ↓

Verification email

        ↓

/verify

        ↓

6-digit OTP

        ↓

Verified

        ↓

Dashboard
```

##:

```text
Email
Password

      ↓

Supabase Auth

      ↓

Check verification

      ↓

Dashboard
```

If the user has not verified their email, redirect them to `/verify`.

---

# 8. EMAIL VERIFICATION

Use a 6-digit OTP verification flow.

The UI should clearly show:

* Email address
* 6 OTP inputs
* Countdown
* Resend code
* Change email
* Error states
* Loading state
* Success state

Add a resend cooldown.

Do not allow unlimited OTP resend requests.

Use Supabase Auth's supported OTP/email verification mechanisms rather than building a custom OTP database.

---

# 9. RESEND

Configure Supabase authentication email delivery through **Resend SMTP**.

Do not put the Resend API key in client-side code.

Use environment variables.

Provide:

```text
.env.example
```

with placeholders, never real secrets.

Expected configuration should be documented clearly.

Example categories:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
```

Only expose variables prefixed with `NEXT_PUBLIC_` to the browser.

Never expose:

```text
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
```

to client-side code.

---

# 10. EMAIL DESIGN

The verification email should be branded as FlowDo.

Conceptually:

```text
FlowDo

Verify your email

Your verification code:

482913

This code expires shortly.

If you didn't create a FlowDo account,
you can safely ignore this email.

© FlowDo
```

Keep the design clean and professional.

If the email is implemented through Supabase's email templates, configure the template appropriately.

---

# 11. PASSWORD RESET

Implement:

```text
/login
    ↓
Forgot password
    ↓
Email
    ↓
Supabase password recovery
    ↓
Reset password
    ↓
Login
```

Do not reveal whether arbitrary email addresses exist.

---

# 12. APPLICATION ROUTING

Use a clean route structure.

Conceptually:

```text
/
├── login
├── signup
├── verify
├── forgot-password
├── reset-password
│
└── app
    ├── dashboard
    ├── inbox
    ├── today
    ├── upcoming
    ├── completed
    ├── calendar
    ├── analytics
    ├── projects
    │   └── [projectId]
    └── settings
        ├── profile
        ├── notifications
        └── security
```

Protect application routes using the recommended Next.js + Supabase SSR authentication approach.

---

# 13. UI / DESIGN

Use `frontend-design:frontend-design`.

The application must NOT look like a generic AI-generated dashboard.

Design a distinctive, polished SaaS interface.

Design principles:

* Minimal
* Modern
* Calm
* Fast
* Productivity-focused
* Excellent typography
* Clear visual hierarchy
* Strong spacing
* Subtle animations
* Excellent empty states
* Excellent loading states
* Excellent error states

Do not overuse cards.

Avoid excessive gradients.

Avoid excessive glassmorphism.

Avoid unnecessary visual decoration.

Prioritize usability.

---

# 14. FLOWDO BRAND

Brand:

```text
FlowDo

Find Your Flow.
```

Create a coherent visual identity around the idea of momentum, focus, and progress.

Use a professional productivity-SaaS aesthetic.

The logo should be simple enough to work as:

* Desktop logo
* Mobile logo
* Favicon
* App icon

Use Lucide icons where appropriate.

---

# 15. DASHBOARD

The dashboard should answer:

1. What do I need to do today?
2. What is overdue?
3. What have I completed?
4. What projects need attention?
5. How productive have I been?

Include:

```text
Greeting

Today's progress

Tasks remaining

Completed tasks

Overdue tasks

Today's tasks

Upcoming tasks

Project summary

Productivity overview
```

Don't overload the dashboard.

The most important tasks should be visible immediately.

---

# 16. TASK EXPERIENCE

Task creation should be fast.

Support:

```text
Title
Description
Project
Priority
Due date
Labels
Subtasks
Recurring schedule
```

The user should be able to create a basic task without filling unnecessary fields.

Support keyboard-friendly interactions where practical.

---

# 17. TASK DETAIL

Task detail should support:

* Title
* Description
* Status
* Priority
* Due date
* Project
* Labels
* Subtasks
* Activity
* Completion

Show task progress when subtasks exist.

Example:

```text
3 / 5 completed
██████████░░░░░ 60%
```

---

# 18. SEARCH AND FILTERING

Implement:

Search by:

* Task title
* Description

Filter by:

* Status
* Priority
* Project
* Label
* Due date

Sorting:

* Due date
* Priority
* Created date
* Alphabetical

Make filtering responsive and intuitive.

---

# 19. CALENDAR

Create a useful calendar view.

Users should be able to see tasks by date.

Support:

* Monthly view
* Date selection
* Tasks on each day
* Creating tasks from a date
* Opening task details

Do not build an unnecessarily complicated calendar library if a lightweight implementation is sufficient.

---

# 20. RECURRING TASKS

Support:

```text
Never
Daily
Weekly
Monthly
Yearly
Custom
```

Design the data model so recurring tasks can be extended later without breaking normal tasks.

Think carefully about timezone and date handling.

---

# 21. NOTIFICATIONS

Architecture should support:

* Due soon
* Overdue
* Daily summary
* Upcoming tasks

Do not build a complicated notification infrastructure in the MVP if it is not required.

Create a clean abstraction so background jobs can be added later.

---

# 22. ANALYTICS

Create a productivity analytics section.

Metrics:

```text
Tasks created
Tasks completed
Completion rate
Overdue tasks
Tasks by project
Tasks by priority
Daily completion
Weekly completion
Monthly completion
```

Charts should be useful and readable.

Don't create charts just for decoration.

---

# 23. REALTIME

Use Supabase Realtime where it provides real product value.

Especially prepare for:

* Shared project updates
* Task changes
* Project activity

Do not add realtime subscriptions everywhere unnecessarily.

---

# 24. PERFORMANCE

Optimize for:

* Fast initial load
* Minimal client-side JavaScript
* Server rendering where appropriate
* Efficient Supabase queries
* Pagination where required
* Indexed database queries
* Avoiding unnecessary realtime subscriptions
* Avoiding unnecessary global state

Do not fetch the entire task database when only today's tasks are needed.

---

# 25. ERROR HANDLING

Every important flow needs:

### Loading

Skeleton/spinner appropriate to context.

### Empty

Helpful empty state with an action.

### Error

Human-readable message and recovery action.

### Success

Clear confirmation without excessive notifications.

Don't expose raw database errors to users.

---

# 26. RESPONSIVE DESIGN

The application must work well on:

* Desktop
* Laptop
* Tablet
* Mobile

On mobile:

* Sidebar becomes a mobile navigation
* Task creation remains easy
* Tables become mobile-friendly layouts
* Modals become sheets where appropriate
* Calendar remains usable
* Touch targets are appropriately sized

---

# 27. ACCESSIBILITY

Follow good accessibility practices.

Include:

* Semantic HTML
* Keyboard navigation
* Visible focus states
* Proper labels
* Accessible dialogs
* Accessible dropdowns
* Appropriate ARIA only when necessary
* Color contrast
* Screen-reader-friendly states

Do not rely on color alone to communicate priority/status.

---

# 28. TESTING

Use `superpowers:test-driven-development`.

Tests should cover critical business behavior.

At minimum:

### Authentication

* Signup
* Login
* Verification
* Protected routes
* Logout
* Password reset

### Tasks

* Create
* Update
* Delete
* Complete
* Reopen
* Ownership enforcement

### Projects

* Create
* Update
* Membership/authorization

### Security

* User cannot access another user's task
* User cannot modify another user's task
* RLS behaves correctly

### UI

Test important user flows.

Do not chase meaningless 100% coverage.

Prioritize business-critical behavior.

---

# 29. CODE QUALITY

Use:

* Strict TypeScript
* Clear naming
* Small reusable components
* Server/client separation
* Typed Supabase operations
* Zod validation
* No unnecessary `any`
* No duplicated business logic
* No secrets in source code
* No dead code
* No console debugging left behind

Run:

```text
lint
typecheck
tests
build
```

before declaring the implementation complete.

---

# 30. DATABASE DEVELOPMENT

Use Supabase migrations.

Do not manually modify production database structure without migration files.

Keep schema changes reproducible.

Every schema change must be represented in the repository.

Generate TypeScript database types from Supabase where practical.

---

# 31. ENVIRONMENT MANAGEMENT

Create/update:

```text
.env.example
```

Document:

```text
Supabase URL
Supabase publishable/anon key
Supabase service role key
Resend configuration
```

Never commit:

```text
.env
```

or real credentials.

---

# 32. DOCUMENTATION

Create/update:

```text
README.md
```

Include:

* Product overview
* Tech stack
* Architecture
* Local setup
* Supabase setup
* Database migrations
* Authentication setup
* Resend setup
* Environment variables
* Running tests
* Running development server
* Build/deployment instructions
* Security notes

Also document any important architectural decisions.

---

# 33. AGENT DELEGATION

Use `superpowers:dispatching-parallel-agents` and `superpowers:subagent-driven-development` when tasks are genuinely independent.

Potential workstreams:

```text
Agent 1
Authentication + Supabase Auth

Agent 2
Database schema + migrations + RLS

Agent 3
Core task/project backend

Agent 4
Frontend design system + layout

Agent 5
Task management UI

Agent 6
Testing
```

Do not have multiple agents modify the same files simultaneously.

Use worktrees when appropriate.

Merge carefully.

The main agent remains responsible for integration and final verification.

---

# 34. CODE REVIEW

Use:

```text
superpowers:requesting-code-review
superpowers:receiving-code-review
```

After substantial implementation:

1. Request review.
2. Read all findings.
3. Categorize them.
4. Fix valid issues.
5. Re-run tests.
6. Re-run typecheck.
7. Re-run build.

Do not dismiss findings without evaluating them.

---

# 35. SYSTEMATIC DEBUGGING

If anything fails:

Do NOT randomly modify code.

Use:

```text
superpowers:systematic-debugging
```

Determine:

```text
Symptom
↓
Reproduction
↓
Evidence
↓
Root cause
↓
Minimal fix
↓
Regression test
↓
Verification
```

This applies especially to:

* Supabase authentication issues
* RLS failures
* SSR/session problems
* TypeScript errors
* Build failures
* hydration issues
* database errors

---

# 36. SECURITY REVIEW

Before completion, specifically review:

### Authentication

* Session handling
* Protected routes
* Email verification
* Password reset
* Logout

### Authorization

* RLS
* Project membership
* Task ownership
* Label ownership

### Secrets

* Resend key
* Supabase service role key
* Environment variables

### Input

* Zod validation
* Server-side validation
* Safe database queries

### Abuse prevention

* OTP resend limits
* Authentication rate limiting where appropriate

---

# 37. MVP PRIORITY

Do not attempt to perfect every advanced feature before the core product works.

Implement in this order:

## Phase 1

```text
Project setup
Supabase
Database
RLS
Auth
Login
Signup
OTP verification
Resend
Protected routes
Dashboard shell
```

## Phase 2

```text
Tasks
Projects
Priorities
Due dates
Task completion
Search
Filtering
```

## Phase 3

```text
Subtasks
Labels
Calendar
Recurring tasks
Activity
Notifications
```

## Phase 4

```text
Analytics
Realtime collaboration
Project members
Advanced productivity features
```

## Phase 5

```text
AI features
```

Do not move to the next phase while the current phase has broken core functionality.

---

# 38. AI FEATURES — FUTURE ARCHITECTURE

Do not implement these unless the MVP and core productivity features are stable.

Future features:

```text
Create tasks from natural language

"Remind me to finish the API docs
tomorrow afternoon"

        ↓

AI

        ↓

Task:
Finish API docs

Due:
Tomorrow 3 PM
```

Other future features:

* AI task breakdown
* AI prioritization
* Dailstem.

---

# 39. GIT

Keep commits clean and meaningful.

Examples:

```text
feat: add supabase authentication
feat: add task management
feat: add project management
feat: add task filtering
fix: enforce task ownership through rls
test: add authentication coverage
test: add task authorization coverage
```

Do not commit:

* Secrets
* Debug logs
* Temporary files
* Generated junk
* Broken intermediate work

Use `superpowers:finishing-a-development-branch` before declaring work complete.

---

# 40. DEFINITION OF DONE

FlowDo is not complete merely because the page renders.

It is complete when:

```text
✓ Application starts
✓ Database migrations work
✓ Supabase connection works
✓ User can register
✓ Verification email works
✓ OTP verification works
✓ Resend works
✓ User can login
✓ User can logout
✓ Protected routes work
✓ User can create tasks
✓ User can edit tasks
✓ User can complete tasks
✓ User can delete tasks
✓ User can create projects
✓ User can filter/search tasks
✓✓ Responsive UI works
✓ Loading states work
✓ Empty states work
✓ Error states work
✓ Tests pass
✓ TypeScript passes
✓ Lint passes
✓ Production build passes
✓ No secrets are committed
✓ README is complete
✓ Code review has been completed
```

---

# 41. IMPORTANT ENGINEERING PRINCIPLE

Do not optimize for "how much code can be written."

Optimize for:

```text
Correctness
+
Security
+
Maintainability
+
User experience
+
Performance
```

When you have to choose between a quick implementation and a robust implementation, choose the robust implementation unless it introduces unnecessary complexity.

Avoid premature abstraction.

Avoid premature microservices.

Avoid unnecessary dependencies.

Keep the application simple enough for a small team to maintain.

---

# 42. START NOW

Begin by:

1. Inspecting the repository.
2. Understanding the existing implementation.
3. Reviewing the available skills.
4. Using the brainstorming workflow to identify architectural decisions.
5. Creating a concrete implementation plan.
6. Presenting the plan before major implementation if the workflow requires it.
7. Breaking the plan into manageable workstreams.
8. Using parallel agents where appropriate.
9. Implementing incrementally.
10. Testing continuously.
11. Reviewing the implementation.
12. Fixing review findings.
13. Running the complete verification suite.
14. Finishing the development branch cleanly.

Do not claim something is implemented until it has actually been implemented and verified.

Do not fabricate successful tests.

Do not skip Supabase RLS verification.

Do not expose secrets.

Do not replace real implementation with placeholders unless explicitly documented as future work.

Build FlowDo as if it is going to production.
