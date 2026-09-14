# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Order Pool is the frontend for a wholesale group-buying platform. Multiple **retailers** jointly fund a **supplier**'s wholesale quantity by joining a **Pool**; once a pool's target quantity is reached, an **administrator** assigns and progresses its delivery through to completion, at which point the supplier is owed a payout. See `docs/design/` for the visual reference (colors, typography) this UI follows.

For more detail than fits here: `docs/project-scope.md` (product spec and terminology), `docs/tech-stack.md` (architecture rationale and conventions), `docs/implementation-plan.md` (phase-by-phase status).

**This is a real client against a real backend** — `order-pools-backend` (a sibling repo; see its own `CLAUDE.md`/`docs/` for the API side). `src/lib/http.ts` is a thin `fetch` wrapper that attaches the JWT access token and silently retries once on a 401 after refreshing it; `src/services/api.ts` (previously `src/mocks/api.ts` — that name predated the real integration and has been renamed since nothing in it is mocked) is the *only* module that calls `request()` from `lib/http.ts`. Pages and components only ever import from `api.ts`, never call `lib/http` directly and never construct a URL themselves — that module is the one place that knows each endpoint's request/response shape (which is **not uniform**: most `getById`/`list`/`update` calls return `{ message, data }`, several `create` calls return the raw saved document, and `/auth/me` returns `{ user }` — each function in `api.ts` unwraps whatever its specific endpoint actually sends).

## Commands

```bash
npm run dev       # start Vite dev server
npm run build     # tsc -b type-check, then vite build
npm run lint      # eslint .
npm run preview   # preview a production build
```

There is no test runner configured for this repo (the backend has one — see `order-pools-backend`'s `docs/tech-stack.md`). UI correctness is verified manually: run the dev server against a running backend and exercise the flow in a browser before calling a change done.

## Architecture

**Stack**: Vite + React 19 + TypeScript + React Router 7 (data router via `createBrowserRouter`) + Tailwind v4. Path alias `@/*` maps to `src/*`.

### Domain model (`src/types/domain.ts`)

Types mirror the backend's actual wire format exactly — field names, Mongo-style `_id` strings, and enum casing (backend enums are `UPPER_SNAKE`, e.g. `Pool.status: "OPEN" | "TARGET_REACHED" | "DISTRIBUTING" | "COMPLETED" | "CANCELLED"`) all match on purpose, so there is no silent renaming layer to keep in sync by hand. **Before inventing a new field or status, check whether `order-pools-backend`'s own model files already define one** — this frontend does not get to decide business rules or shapes; the backend does. `AppUser.roles: UserRole[]` is a real array — a single account can hold more than one role at once (e.g. `RETAILER` + `SUPPLIER`), so don't assume `roles.length === 1` anywhere.

### Auth & routing

`src/context/AuthContext.tsx` holds the signed-in `AppUser`, fetched from a real `GET /auth/me` using a JWT stored via `src/lib/tokenStore.ts`. `login`/`signup` call the real `POST /auth/login` / `POST /auth/register`; `updateProfile`/`removeAccount` call `PATCH` / `DELETE /auth/me` and `/auth/remove` respectively. There is no demo-account shortcut — every session is a real authenticated one.

`src/routes/router.tsx` defines three parallel route trees under `/retailer`, `/supplier`, `/admin`, each wrapped by `ProtectedRoute` (`src/routes/ProtectedRoute.tsx`), which redirects to `/login` if signed out or to the user's own role root if the role doesn't match the route (a dual-role user's "own root" is resolved by `src/lib/panel.ts`'s priority order: admin > supplier > retailer). Each leaf route sets `handle: { title }`; `AppShell` reads the deepest match's handle via `useMatches()` to drive the Topbar heading — add `handle: { title: "..." }` on any new route rather than hardcoding a page title elsewhere.

### Layout & navigation

`AppShell` (`src/components/layout/`) renders `Sidebar` + `Topbar` + `<Outlet />`, with a desktop-fixed sidebar and a slide-in drawer on mobile. Sidebar nav items per role live in `src/config/nav.ts` (`NAV_ITEMS`) — add a new nav entry there when adding a page that belongs in the sidebar (a few pages, like the address book, are deliberately reached only via a link on the Profile page instead of cluttering the sidebar — that's fine too), using an icon from `src/components/ui/icons.tsx` (hand-rolled inline SVGs, no icon package dependency).

### Components

- `components/ui/` — generic, role-agnostic primitives (Button, LinkButton, Card, Modal, DataTable, StatusBadge, Field inputs, EmptyState/ErrorState/Spinner, Pagination). `Button` and `LinkButton` share class generation via `buttonClasses()` exported from `Button.tsx` (react-router `<Link>` can't be a real `<button>`, so this avoids an `asChild`/Slot dependency).
- `components/domain/` — Order-Pool-specific presentational pieces reused across roles: `PoolCard` (grid/list card), `PoolOverview` (the full pool detail layout, shared by retailer/supplier/admin pool-detail pages — each adds its own action slot as `children`, e.g. the retailer's join button or the admin's assign-delivery/expire-pool buttons), `NotificationItem`, `ProfileCard`, `ProfileActions` (edit-profile/address-book-link/account-removal, shared by both `RetailerProfilePage` and `SupplierProfilePage`), `AddressFields` (the location/region/city/street form, shared by signup, the join-a-pool flow, and the address book).
- `DataTable` renders a `<table>` on `sm:` and up and auto-generates stacked cards below that from the same `Column[]` definition — pass `renderMobileTitle` to control the card heading, and `hideOnMobileCard` on columns that would duplicate it.
- `StatusBadge` has one shared label/color map covering every status across pools, offers, complaints, deliveries, participants, payments, and payouts (`src/components/ui/StatusBadge.tsx`) — add new statuses there rather than creating a parallel badge component. A `domain` prop disambiguates only where a bare status string would otherwise collide across entities (e.g. `OPEN` means "still collecting" for a Pool but "not yet addressed" for a Complaint).

### Data fetching

`useFetch(fetcher, deps)` (`src/hooks/useFetch.ts`) is the generic loading/error/data wrapper used by every page against the real API; `useNotifications(userId)` additionally exposes unread count and read/mark-all-read actions (optimistic, resyncing from the server if the underlying `PATCH` fails) and is shared by the Topbar dropdown and the notifications pages.

### The payment redirect flow

Joining a pool (`PoolDetailPage`) gets back a `checkoutUrl` and hard-redirects the browser to Thawani's hosted checkout (`window.location.assign`) — this leaves the SPA entirely. Thawani redirects back to `/payments/:paymentId/result?outcome=success|cancelled`, handled by `PaymentResultPage`, which never trusts that query param as proof of anything — it always calls the real `confirmPayment`/`cancelPayment` endpoint to reconcile. `MyJoinsPage` also surfaces a "Resume checkout" / "Cancel" action for any `PENDING` payment (using a `checkoutUrl` the backend re-derives on `GET /payments`), covering a retailer who closed the tab mid-checkout instead of landing back on that page.

### Styling

Tailwind v4, configured via `@theme` in `src/index.css` (no `tailwind.config.js`) — brand tokens are `primary`/`secondary`/`tertiary`/`neutral` plus `-hover` variants, matching `docs/design/order-pool-design-system.png`. Headings use Geist Sans, body text uses Inter, both self-hosted via `@fontsource/*` (no external font requests).
