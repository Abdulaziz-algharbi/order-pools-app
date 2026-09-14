# Order Pool

Frontend for Order Pool, a multi-role wholesale group-purchasing platform. Suppliers offer products at wholesale quantities; retailers collectively fund a **Pool** until it reaches its target, then the order is fulfilled and delivered. Retailers, suppliers, and administrators each get their own dashboard and workflow.

See [`docs/project-scope.md`](docs/project-scope.md) for the full product scope, [`docs/tech-stack.md`](docs/tech-stack.md) for architecture and technology choices, and [`docs/implementation-plan.md`](docs/implementation-plan.md) for what's built and what's left.

## Status

This is a real client against a real backend, [`order-pools-backend`](../order-pools-backend) (a sibling repo). `src/services/api.ts` is the typed API client every page/component calls through; there is no mock or in-memory data.

## Getting started

```bash
npm install
npm run dev
```

Open the printed local URL and sign in or sign up for a real account — there is no demo-account shortcut, and `order-pools-backend` must be running for the app to do anything.

## Commands

```bash
npm run dev       # start the Vite dev server
npm run build     # type-check and produce a production build
npm run lint      # run ESLint
npm run preview   # preview the production build locally
```

## Tech stack

Vite · React 19 · TypeScript · React Router 7 · Tailwind CSS v4. See [`docs/tech-stack.md`](docs/tech-stack.md) for the full rationale and project conventions (folder layout, path aliases, component structure).

## Project structure

```
src/
  components/
    ui/        generic UI primitives (Button, Modal, DataTable, StatusBadge, ...)
    domain/    Order-Pool-specific pieces shared across roles (PoolCard, PoolOverview, ...)
    layout/    app shell, sidebar, topbar
  pages/
    retailer/  supplier/  admin/  shared/  auth/
  routes/      router config and role-based route guards
  context/     auth context
  services/    API client (src/services/api.ts) against the real backend
  lib/         fetch wrapper, token storage, and other low-level helpers
  types/       domain types (Pool, SupplierOffer, Complaint, ...)
  config/      per-role navigation config
docs/
  design/      visual design references
  project-scope.md
  tech-stack.md
  implementation-plan.md
```

## Design reference

Visual design follows `docs/design/order-pool-product-reference.png` (layout/UX) and `docs/design/order-pool-design-system.png` (colors, typography). Brand colors: `#0F172A` (primary), `#10B981` (secondary), `#6366F1` (tertiary), `#F8FAFC` (neutral). Headings use Geist, body text uses Inter.
