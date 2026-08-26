# Order Pool

Frontend for Order Pool, a multi-role wholesale group-purchasing platform. Suppliers offer products at wholesale quantities; retailers collectively fund a **Pool** until it reaches its target, then the order is fulfilled and delivered. Retailers, suppliers, and administrators each get their own dashboard and workflow.

See [`docs/project-scope.md`](docs/project-scope.md) for the full product scope, [`docs/tech-stack.md`](docs/tech-stack.md) for architecture and technology choices, and [`docs/implementation-plan.md`](docs/implementation-plan.md) for what's built and what's left.

## Status

This build is **not connected to a real backend yet**. All data (users, pools, offers, complaints, notifications) is served from an in-memory mock API (`src/mocks/api.ts`) seeded with sample data. Every function in that module is already shaped like a real HTTP call, so wiring up the real backend is expected to be a contained change to that one file.

## Getting started

```bash
npm install
npm run dev
```

Open the printed local URL and sign in from the **Demo accounts** panel on the login screen — pick any retailer, supplier, or administrator account to explore that role's dashboard. There's no real password check yet.

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
  mocks/       mock API + seed data (stands in for the backend)
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
