# Order Pool — Tech Stack

## Summary

| Concern | Choice |
|---|---|
| Build tool | Vite 6 |
| Framework | React 19 |
| Language | TypeScript 5.7 (strict) |
| Routing | React Router 7 (`createBrowserRouter` data router) |
| Styling | Tailwind CSS v4 |
| Fonts | Geist Sans (headings), Inter (body) — self-hosted via `@fontsource/*` |
| State/data | React state + a hand-rolled mock API layer (no backend yet) |
| Linting | ESLint 9 (flat config) + typescript-eslint |

No component library, no state-management library, no CSS-in-JS, no test runner (not yet configured).

## Why these choices

**Vite + React + TypeScript**, chosen over Next.js: the app is a pure client-side SPA that will talk to an external API once one exists — there's no server-rendering or API-route requirement, so Next.js's SSR/App Router machinery would be unused weight. Vite gives a fast dev loop and a small, understandable build.

**React Router 7's data router** (`createBrowserRouter`) rather than plain component routing: it lets each route declare a `handle: { title }`, which the shared `AppShell` reads via `useMatches()` to drive the page title in the Topbar without every page having to set it manually. It also has an ergonomic pattern for role-guarded route trees (see `src/routes/ProtectedRoute.tsx`).

**Tailwind v4**, configured via the `@theme` directive directly in `src/index.css` (no `tailwind.config.js` needed in v4). The brand palette from the design system (`primary` `#0F172A`, `secondary` `#10B981`, `tertiary` `#6366F1`, `neutral` `#F8FAFC`) is defined as first-class theme tokens, so utility classes like `bg-primary`, `text-tertiary`, `bg-secondary-hover` are available directly, matching the design reference vocabulary rather than reaching for Tailwind's default slate/emerald/indigo names.

**Self-hosted fonts** (`@fontsource/geist-sans`, `@fontsource/inter`) instead of a Google Fonts `<link>`: keeps the app fully self-contained with no external network dependency at render time.

**No component library** (shadcn/ui, MUI, etc.): the UI kit in `src/components/ui/` is small, hand-built, and directly matches the design system's tokens rather than adapting a third-party theme. Given the number of shared concepts (pool cards, status badges, data tables that collapse to cards on mobile), a bespoke kit stayed easier to keep consistent than customizing an off-the-shelf one.

**No global state library** (Redux, Zustand, etc.): auth is the only cross-cutting state and lives in a single `AuthContext`; everything else is page-local `useState`/`useFetch` against the mock API. This is intentionally minimal — if server state grows in complexity once a real backend and caching/revalidation needs exist, introducing a data-fetching library (e.g. TanStack Query) at that point is a contained change, isolated to `useFetch`'s call sites.

## The mock data layer

There is no backend yet. `src/mocks/api.ts` is the single module that stands in for one:

- `src/mocks/seed.ts` holds static seed data (users, pools, offers, complaints, notifications) for every role.
- `src/mocks/api.ts` exposes `async` functions — `listPools`, `joinPool`, `createOffer`, `decideOffer`, `assignDelivery`, etc. — each shaped exactly like a real HTTP call would be: typed params in, typed data out, artificial latency via `delay()`. State is mutated in-memory for the lifetime of the browser session (e.g. joining a pool actually updates its progress and participant list).

This boundary is deliberate: **no other file imports from `seed.ts` directly**, and pages only ever call functions from `api.ts`. When the real backend and its API spec are available, integration should be a matter of rewriting the function bodies in `api.ts` (or replacing it with a real HTTP client module of the same shape) — not touching any page or component.

## Project conventions

- **Path alias**: `@/*` → `src/*` (configured in both `vite.config.ts` and `tsconfig.app.json`).
- **Component layers**:
  - `components/ui/` — generic, role-agnostic primitives (Button, Modal, DataTable, StatusBadge, form fields, empty/error/loading states).
  - `components/domain/` — Order-Pool-specific presentational pieces reused across roles (PoolCard, PoolOverview, NotificationItem, ProfileCard).
  - `components/layout/` — the app shell, sidebar, topbar, page header.
- **Pages** are grouped by role under `src/pages/{retailer,supplier,admin}/`, plus `src/pages/shared/` for pages identical across roles (e.g. Notifications) and `src/pages/auth/` for the login screen.
- **Routing** lives entirely in `src/routes/router.tsx`; role-based navigation items live in `src/config/nav.ts`.
- **Domain types** are centralized in `src/types/domain.ts` and mirror the concepts in `docs/project-scope.md` — this is the file to check before adding any new field or status.

## Tooling commands

```bash
npm install       # install dependencies
npm run dev       # start the Vite dev server
npm run build     # type-check (tsc -b) then produce a production build
npm run lint      # ESLint across the project
npm run preview   # serve the production build locally
```

## Known gaps (by design, for now)

- **No automated tests.** No test runner is configured yet; UI correctness has so far been verified manually (dev server + manual/headless-browser walkthroughs) rather than with a test suite.
- **No real authentication.** `LoginPage` picks from seeded demo accounts; there is no password check, token, or session beyond a user id in `localStorage`.
- **No backend.** See "The mock data layer" above.
