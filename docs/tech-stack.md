# Order Pool — Tech Stack

> Derived from `package.json`, `src/`, and the sibling `order-pools-backend` repo on 2026-09-13. This is a snapshot — re-verify against the code before relying on it for anything load-bearing.

## Summary

| Concern | Choice |
|---|---|
| Build tool | Vite 6 |
| Framework | React 19 |
| Language | TypeScript 5.7 (strict) |
| Routing | React Router 7 (`createBrowserRouter` data router) |
| Styling | Tailwind CSS v4 |
| Fonts | Geist Sans (headings), Inter (body) — self-hosted via `@fontsource/*` |
| State/data | React state + a thin typed client (`src/services/api.ts`) against the real `order-pools-backend` API |
| Auth | Real JWT access/refresh tokens (see "Auth" below) |
| Linting | ESLint 9 (flat config) + typescript-eslint |

No component library, no state-management library, no CSS-in-JS, no test runner.

## Why these choices

**Vite + React + TypeScript**, chosen over Next.js: the app is a pure client-side SPA against an external API — there's no server-rendering or API-route requirement, so Next.js's SSR/App Router machinery would be unused weight. Vite gives a fast dev loop and a small, understandable build.

**React Router 7's data router** (`createBrowserRouter`) rather than plain component routing: it lets each route declare a `handle: { title }`, which the shared `AppShell` reads via `useMatches()` to drive the page title in the Topbar without every page having to set it manually. It also has an ergonomic pattern for role-guarded route trees (see `src/routes/ProtectedRoute.tsx`).

**Tailwind v4**, configured via the `@theme` directive directly in `src/index.css` (no `tailwind.config.js` needed in v4). The brand palette from the design system (`primary` `#0F172A`, `secondary` `#10B981`, `tertiary` `#6366F1`, `neutral` `#F8FAFC`) is defined as first-class theme tokens, so utility classes like `bg-primary`, `text-tertiary`, `bg-secondary-hover` are available directly, matching the design reference vocabulary rather than reaching for Tailwind's default slate/emerald/indigo names.

**Self-hosted fonts** (`@fontsource/geist-sans`, `@fontsource/inter`) instead of a Google Fonts `<link>`: keeps the app fully self-contained with no external network dependency at render time.

**No component library** (shadcn/ui, MUI, etc.): the UI kit in `src/components/ui/` is small, hand-built, and directly matches the design system's tokens rather than adapting a third-party theme.

**No global state library** (Redux, Zustand, etc.): auth is the only cross-cutting state and lives in a single `AuthContext`; everything else is page-local `useState`/`useFetch` against the real API. If server-state complexity (caching, revalidation, request de-duplication) grows enough to justify it, introducing a data-fetching library (e.g. TanStack Query) is a contained change, isolated to `useFetch`'s call sites — nothing about the current design blocks that later.

## Backend integration

There is a real backend: `order-pools-backend` (a sibling repo). `VITE_API_BASE_URL` (`.env`, e.g. `http://localhost:8000/api/v1` in local dev) points at it.

- `src/lib/http.ts` — the only place that calls `fetch()` directly. Attaches `Authorization: Bearer <accessToken>` from `src/lib/tokenStore.ts`; on a 401 it silently attempts one token refresh (de-duplicated — concurrent 401s share one in-flight refresh, not one each) and retries the original request once before giving up and dispatching a `order-pool:session-expired` window event (handled by `AuthContext`, which drops the session).
- `src/services/api.ts` — the real, only API client (formerly `src/mocks/api.ts`, a name left over from before the real backend was wired up). Every page/component calls functions from here, never `lib/http` directly. Response envelopes are **not uniform** across the backend (`{message, data}` vs. a raw document vs. `{user}`, etc.) — each function here unwraps whatever its specific endpoint actually sends; see `order-pools-backend`'s own docs for the authoritative shape per endpoint.
- The Thawani checkout redirect is a genuine full-page hand-off: `PoolDetailPage`'s join flow does `window.location.assign(checkoutUrl)` to Thawani's own hosted page, and `PaymentResultPage` (mounted at `/payments/:paymentId/result`, outside any role-guarded tree) is where Thawani redirects back to. See `CLAUDE.md`'s "The payment redirect flow" for how that reconciles.

## Auth

Real JWT access/refresh tokens (`src/lib/tokenStore.ts`, currently `localStorage`) — no demo-account shortcut. `AuthContext` exposes `login`, `signup`, `logout`, `updateProfile` (`PATCH /auth/me` — name/phone/company/password, never roles or email), and `removeAccount` (`DELETE /auth/remove` — deletes a retailer-only account immediately; for an account holding `SUPPLIER`, files a review request instead and returns `{ deleted: false }`, which `AuthContext` uses to decide whether to actually clear the local session).

## Project conventions

- **Path alias**: `@/*` → `src/*` (configured in both `vite.config.ts` and `tsconfig.app.json`).
- **Component layers**:
  - `components/ui/` — generic, role-agnostic primitives (Button, Modal, DataTable, StatusBadge, form fields, empty/error/loading states).
  - `components/domain/` — Order-Pool-specific presentational pieces reused across roles (PoolCard, PoolOverview, NotificationItem, ProfileCard, ProfileActions, AddressFields).
  - `components/layout/` — the app shell, sidebar, topbar, page header.
- **Pages** are grouped by role under `src/pages/{retailer,supplier,admin}/`, plus `src/pages/shared/` for pages identical across roles (Notifications, the address book, the payment-result landing page) and `src/pages/auth/` for login/signup.
- **Routing** lives entirely in `src/routes/router.tsx`; role-based navigation items live in `src/config/nav.ts`. Not every route needs a nav entry — some (address book) are only linked to from another page.
- **Domain types** are centralized in `src/types/domain.ts` and mirror the backend's actual model shapes exactly — this is the file to check before adding any new field or status, and the backend's own model files are the ground truth if this drifts.

## Tooling commands

```bash
npm install       # install dependencies
npm run dev       # start the Vite dev server
npm run build     # type-check (tsc -b) then produce a production build
npm run lint      # ESLint across the project
npm run preview   # serve the production build locally
```

## Known gaps (as of this writing)

- **No automated tests.** No test runner is configured; UI correctness is verified manually — run the dev server against a running backend and exercise the flow in a real browser.
- **No route-based code splitting.** The production build is a single JS chunk (~120 KB gzipped as of this writing).
- **No accessibility pass beyond the basics already in place** (keyboard navigation, focus management in modals, a full ARIA labeling audit).
