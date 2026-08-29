# FLOWDO-7: Dark Mode — Implementation Report

Branch: `flowdo-7-dark-mode`
Commit: `e967e54` — "FLOWDO-7: add dark mode with Light/Dark/System toggle"

## Summary

Phase 1 scaffolding already shipped complete CSS-variable-based theming
(`app/globals.css` has a full `.dark` class; `tailwind.config.ts` maps every
semantic color to those variables and has `darkMode: ["class"]`), and every
component already used semantic Tailwind classes rather than hardcoded
colors. The only missing piece was the *mechanism*: toggling the `dark`
class on `<html>`, respecting/detecting OS preference, persisting the
choice, and avoiding a flash of the wrong theme on load. This was
implemented with `next-themes`, plus a `ThemeToggle` UI component surfaced
in Settings > Profile, plus a verification audit of the rest of the
codebase for any theme-breaking hardcoded colors.

## Files created

- `components/theme-provider.tsx` — thin client wrapper around
  `next-themes`'s `ThemeProvider`, re-exported so app code imports from
  `@/components/theme-provider`.
- `components/theme-toggle.tsx` — Light/Dark/System radio-group toggle
  using `useTheme()` from `next-themes`, Lucide `Sun`/`Moon`/`Monitor`
  icons (confirmed present in the installed `lucide-react@^0.451.0`), and
  the codebase's semantic Tailwind tokens (`bg-primary`,
  `text-primary-foreground`, `text-muted-foreground`, `border-border`).
  Uses the standard `mounted` guard so the very first client render
  (before next-themes' script has resolved `theme`) doesn't cause a
  hydration mismatch.
- `components/theme-toggle.test.tsx` — unit tests (see "Tests" below).

## Files modified

- `app/providers.tsx` — added `ThemeProvider` (from
  `components/theme-provider.tsx`) wrapping the existing
  `QueryClientProvider`, configured `attribute="class"` (matches Tailwind's
  `darkMode: ["class"]`), `defaultTheme="system"`, `enableSystem`.
- `app/layout.tsx` — added `suppressHydrationWarning` to the `<html>`
  element. This is required because next-themes sets the `dark` class via
  a synchronous inline script that runs before React hydrates, which would
  otherwise cause a React server/client mismatch warning on `<html>`. This
  is the documented, standard usage pattern for this library.
- `app/app/settings/profile/page.tsx` — added an "Appearance" section
  (heading + one-line description + `<ThemeToggle />`) below the existing
  profile form, separated with a `border-t border-border`. The page is a
  Server Component; `ThemeToggle` is a Client Component rendered directly
  as a child (no function props crossing the RSC boundary), which is
  standard and fine.
- `package.json` / `package-lock.json` — added `next-themes@^0.4.6` as a
  dependency (verified: this is the *only* new entry in the lockfile diff;
  a temporary `playwright` install used only for live verification, see
  below, was installed with `--no-save`/uninstalled afterward and left no
  trace in `package.json` or `package-lock.json` — confirmed by diff).

## Audit pass (step 7)

Grepped `app/` and `components/` for:

- `bg-white` / `bg-black` / `text-white` / `text-black` — 3 hits, all
  `bg-black/30` used as a `<Dialog.Overlay>` backdrop scrim in
  `components/tasks/task-detail-panel.tsx`, `components/projects/project-form-dialog.tsx`,
  and `components/dashboard/mobile-nav.tsx`. **Not a bug** — a translucent
  black modal scrim over dimmed background content is standard and correct
  in both light and dark themes (it's not a "surface" color that should
  flip); left as-is.
- Inline `style={{ ... }}` color usage — 4 hits, in
  `components/projects/project-form-dialog.tsx`,
  `components/projects/project-stats-header.tsx`, and
  `components/projects/project-card.tsx`. All of them consume
  `color.value` / `project.color` sourced from
  `lib/constants/project-colors.ts` (`PROJECT_COLORS`) — explicitly
  excluded from this audit per task instructions as deliberately
  fixed, user-chosen project accent colors, not theme tokens. One
  additional hit (`project-stats-header.tsx`'s progress bar) uses
  `bg-primary` (a semantic token) with only `width` set inline — no
  color concern.
- Literal hex colors (`#RRGGBB`) in `.tsx`/`.ts` — 1 hit, in a **test
  fixture** (`components/tasks/task-detail-panel.test.tsx:77`, a mock
  label color for a test assertion) — not rendered UI, no action needed.
- `bg-gray-*` / `text-slate-*` / `border-zinc-*` / etc. (any Tailwind
  gray-scale palette utility) — **zero hits**.
- Any pre-existing `dark:` variant usage — **zero hits** (confirms no
  ad-hoc dark-mode overrides exist that could conflict with the new
  `next-themes` class-based toggling).

**Finding: nothing to fix.** The existing semantic-token discipline from
Phase 1 already covers every page and component; the only non-token colors
in the codebase are the intentional modal-scrim black and the
explicitly-out-of-scope `PROJECT_COLORS` accent colors.

## Tests

`components/theme-toggle.test.tsx` renders `ThemeToggle` wrapped in the
**real** `next-themes` `ThemeProvider` (not a mock of `useTheme`), per the
task's stated preference for exercising real behavior. `window.matchMedia`
is mocked (jsdom doesn't implement it, and next-themes calls it to resolve
`system`); `document.documentElement.className` and `localStorage` are
reset in `beforeEach`.

Verification approach chosen: **`document.documentElement.classList` +
`localStorage.getItem("theme")`**, both directly observable in jsdom
without needing computed-style assertions (which are less reliable in
jsdom than in a real browser — used only in the live browser check below,
where real Tailwind CSS is actually applied).

Three tests:
1. Renders all three radio options (Light, Dark, System).
2. Clicking "Dark" → `document.documentElement.classList.contains("dark")`
   is `true`, `localStorage.getItem("theme")` is `"dark"`, and the Dark
   radio has `aria-checked="true"`.
3. Clicking "Dark" then "Light" → the `dark` class is removed and
   `localStorage` reflects `"light"`.

All 3 pass.

## Verification command output

### 1. `npm run lint`
```
✖ 2 problems (0 errors, 2 warnings)
```
Both warnings are pre-existing (`eslint.config.mjs`, `postcss.config.mjs` —
`import/no-anonymous-default-export`), unrelated to this change. **0
errors.**

### 2. `npm run typecheck`
```
> tsc --noEmit
```
No output — clean pass.

### 3. `npm test`
```
Test Files  15 passed (15)
     Tests  70 passed (70)
```
Includes the 3 new `theme-toggle.test.tsx` tests plus all 67 pre-existing
unit tests.

### 4. `npm run test:integration`
```
Test Files  13 passed (13)
     Tests  41 passed (41)
```
Run against local Supabase (`npx supabase status` confirmed running
throughout). No flake observed on `tests/integration/profile.test.ts` (or
anywhere else) on this run — full suite green on the first attempt, no
retry needed.

### 5. `npm run build`
```
✓ Compiled successfully
✓ Generating static pages (21/21)
```
Production build succeeds; route/bundle table unchanged in shape aside
from the expected small size bump on pages that now import theme code via
the shared `Providers` tree.

All five commands are green.

## Live visual check

**Method used:** a temporary local dev server + a real Chromium browser
session via Playwright (`npm install --no-save playwright@1.62.1`, using
the already-cached browser binary at `~/Library/Caches/ms-playwright`;
uninstalled afterward with `npm uninstall --no-save playwright` — confirmed
via `git diff package.json`/`package-lock.json` that this left zero trace).

Steps taken:
1. Confirmed local Supabase running (`npx supabase status`,
   `API_URL: http://127.0.0.1:54321`).
2. Started `npm run dev -- -p 3100` with `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
   exported **only into that one background process's environment**
   (process env vars take precedence over `.env.local` in Next.js's env
   loading order) — **`.env.local` itself was never read, written, or
   modified.**
3. Created a confirmed test user directly against the local Supabase
   Auth admin API (`darkmode-check@example.com`) — never touched the
   hosted project, never attempted a real signup/login flow against it.
4. Drove the real app in Chromium: logged in through the actual `/login`
   form (redirected to `/app/dashboard`, confirming the session was
   against local Supabase, not the hosted project), navigated to
   `/app/settings/profile`, confirmed the "Appearance" section and
   `ThemeToggle` render.
5. Clicked each option and asserted, via `page.evaluate`, on
   `document.documentElement.className` and
   `getComputedStyle(document.body).backgroundColor` (the real Tailwind
   CSS variables actually resolved by the browser):
   - Initial: `html` class `"light"`, `body` bg `rgb(255, 255, 255)`.
   - Click **Dark**: `html` class → `"dark"`, `body` bg →
     `rgb(18, 18, 22)` (matches `--background: 240 10% 8%` in dark mode).
   - Click **Light**: `html` class → `"light"`, `body` bg back to
     `rgb(255, 255, 255)`.
   - Click **System**: `html` class → `"light"` (this headless
     environment has no dark OS preference), and
     `localStorage.getItem("theme")` → `"system"` (correctly persists the
     *explicit choice of "System"*, not a resolved value).
6. Took full-page screenshots before and after toggling to Dark
   (`/tmp/dark-mode-before.png`, `/tmp/dark-mode-dark.png`) — visually
   confirmed the entire app shell (sidebar, nav, form inputs, buttons,
   borders, the "Save changes" primary button, the toggle's own selected-
   state highlight) re-themes correctly with no unstyled/broken elements,
   confirming the semantic-token audit's conclusion held in a real
   browser render, not just in the CSS source.
7. Cleaned up: killed the dev server, deleted the local test user via the
   Supabase admin API, removed the temporary Playwright install and script.

**Result: pass.** The toggle correctly drives the `dark` class on `<html>`,
the resulting computed styles match the intended CSS-variable values in
both themes, and System mode correctly resolves to and persists as an
explicit "system" preference.

## Concerns

None. All five required verification commands pass; the live check
confirms real-browser behavior matches the unit tests and the CSS design;
the audit pass found no hardcoded colors needing a fix; no secrets were
touched or committed; `.env.local` was never modified; only the current
branch was committed to (`flowdo-7-dark-mode`), no merge/push performed.
