# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Order Pool is a frontend for a wholesale group-buying platform. Multiple **retailers** jointly fund a **supplier**'s wholesale quantity by joining a **Pool**; once a pool's target quantity is reached it becomes "met" and moves into delivery. An **administrator** reviews supplier offers before they become pools and assigns delivery once a pool is met. See `docs/design/` for the visual reference (colors, typography) this UI follows.

For more detail than fits here: `docs/project-scope.md` (full product spec and terminology), `docs/tech-stack.md` (architecture rationale and conventions), `docs/implementation-plan.md` (phase-by-phase status).

There is **no backend yet** — `src/mocks/api.ts` is a hand-rolled mock API (in-memory state, seeded from `src/mocks/seed.ts`, artificial latency) that stands in for it. Every exported function there is already shaped like a real async request (typed params in, typed data out), so integrating the real backend should only ever require rewriting the bodies of `src/mocks/api.ts` — pages and components must never import from `src/mocks/seed.ts` directly or reach around this module.

## Commands

```bash
npm run dev       # start Vite dev server
npm run build     # tsc -b type-check, then vite build
npm run lint      # eslint .
npm run preview   # preview a production build
```

There is no test runner configured yet.

## Architecture

**Stack**: Vite + React 19 + TypeScript + React Router 7 (data router via `createBrowserRouter`) + Tailwind v4. Path alias `@/*` maps to `src/*`.

### Domain model (`src/types/domain.ts`)

Three roles: `retailer`, `supplier`, `admin` (`AppUser` is a discriminated union on `role`). Core lifecycle:

`SupplierOffer` (`pending_review` → `negotiation` | `accepted` | `refused`) — an accepted offer becomes a `Pool` (`active` → `met` → `delivery_assigned` → `delivered` → `closed`). A retailer's participation in a pool is a `Join`. Do not invent new statuses or fields without checking whether the real backend spec (once provided) already defines them — the mock layer intentionally mirrors what's expected from the API, not arbitrary UI convenience fields.

### Auth & routing

`src/context/AuthContext.tsx` holds the signed-in `AppUser`, persisted as just a user id in `localStorage` (`loginAs(userId)` looks the user up via the mock API). There's no real credential check — `LoginPage` offers "demo accounts" per role.

`src/routes/router.tsx` defines three parallel route trees under `/retailer`, `/supplier`, `/admin`, each wrapped by `ProtectedRoute` (`src/routes/ProtectedRoute.tsx`), which redirects to `/login` if signed out or to the user's own role root if the role doesn't match the route. Each leaf route sets `handle: { title }`; `AppShell` reads the deepest match's handle via `useMatches()` to drive the Topbar heading — add `handle: { title: "..." }` on any new route rather than hardcoding a page title elsewhere.

### Layout & navigation

`AppShell` (`src/components/layout/`) renders `Sidebar` + `Topbar` + `<Outlet />`, with a desktop-fixed sidebar and a slide-in drawer on mobile. Sidebar nav items per role live in `src/config/nav.ts` (`NAV_ITEMS`) — add a new nav entry there when adding a page, using an icon from `src/components/ui/icons.tsx` (hand-rolled inline SVGs, no icon package dependency).

### Components

- `components/ui/` — generic, role-agnostic primitives (Button, LinkButton, Card, Modal, DataTable, StatusBadge, Field inputs, EmptyState/ErrorState/Spinner, Pagination). `Button` and `LinkButton` share class generation via `buttonClasses()` exported from `Button.tsx` (react-router `<Link>` can't be a real `<button>`, so this avoids an `asChild`/Slot dependency).
- `components/domain/` — Order-Pool-specific presentational pieces reused across roles: `PoolCard` (grid/list card), `PoolOverview` (the full pool detail layout, shared by retailer/supplier/admin pool-detail pages — each adds its own action slot as `children`, e.g. the retailer's join button or the admin's assign-delivery button), `NotificationItem`, `ProfileCard`.
- `DataTable` renders a `<table>` on `sm:` and up and auto-generates stacked cards below that from the same `Column[]` definition — pass `renderMobileTitle` to control the card heading, and `hideOnMobileCard` on columns that would duplicate it.
- `StatusBadge` has one shared label/color map covering every status across pools, offers, complaints, deliveries, and supplier requests (`src/components/ui/StatusBadge.tsx`) — add new statuses there rather than creating a parallel badge component.

### Data fetching

`useFetch(fetcher, deps)` (`src/hooks/useFetch.ts`) is the generic loading/error/data wrapper used by every page against the mock API; `useNotifications(userId)` additionally exposes unread count and read/mark-all-read actions and is shared by the Topbar dropdown and the notifications pages.

### Styling

Tailwind v4, configured via `@theme` in `src/index.css` (no `tailwind.config.js`) — brand tokens are `primary`/`secondary`/`tertiary`/`neutral` plus `-hover` variants, matching `docs/design/order-pool-design-system.png`. Headings use Geist Sans, body text uses Inter, both self-hosted via `@fontsource/*` (no external font requests).
