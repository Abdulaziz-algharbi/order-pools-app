# Order Pool — Implementation Plan

This tracks the phased build-out described in the project scope. Phases 1–4 are implemented against mock data (see `docs/tech-stack.md`); nothing here has been connected to a real backend yet.

## Phase 1 — Foundation ✅ Done

- [x] Project scaffold (Vite + React 19 + TypeScript + Tailwind v4)
- [x] Design system tokens (colors, Geist/Inter fonts) wired into Tailwind's `@theme`
- [x] Routing skeleton (`react-router` data router, role-scoped route trees)
- [x] Mock authentication (`AuthContext`, demo-account login page, `localStorage` session)
- [x] Role-based route guards (`ProtectedRoute`)
- [x] Responsive app shell: fixed sidebar (desktop) / drawer (mobile), topbar with notification dropdown and profile menu
- [x] Reusable UI kit: Button, LinkButton, Card, StatusBadge, ProgressBar, Modal, DataTable (responsive card fallback), Pagination, EmptyState, ErrorState, Spinner/Skeleton, form fields
- [x] Mock API layer (`src/mocks/api.ts`) with seed data covering all three roles

## Phase 2 — Retailer ✅ Done

- [x] Browse pools (search/filter over active pools)
- [x] Pool detail page (product, supplier, price, progress, minimum contribution, deadline, "what happens next")
- [x] Join a pool (quantity validation against minimum contribution and remaining capacity, optimistic progress update)
- [x] My Joins (contribution, pool progress, status per join)
- [x] Track Deliveries (stage timeline: met → driver assigned → delivered)
- [x] Complaints (create, view history and responses)
- [x] Notifications (dropdown + dedicated page, mark read/mark all read)
- [x] Profile

## Phase 3 — Supplier ✅ Done

- [x] Dashboard (offers awaiting decision, pools nearing fulfillment)
- [x] Active pools list + read-only detail view
- [x] Create offer (validated form: quantity, minimum contribution ≤ target, price, future deadline)
- [x] Offer list + detail, with admin decision/notes surfaced
- [x] Pool history (met/delivered/closed pools for this supplier)
- [x] Notifications (shared page/component with retailer)
- [x] Profile (with verification status)

## Phase 4 — Administrator ✅ Done

- [x] Dashboard organized around pending actions (offers to review, pools ready for delivery, open complaints, pending supplier requests)
- [x] Supplier offer review queue (accept / request negotiation / refuse, with required notes on non-accept decisions)
- [x] Offers history
- [x] Active pools (all suppliers)
- [x] Met pools + delivery assignment (driver name/phone/ETA)
- [x] Pool history (all suppliers)
- [x] Track pools (delivery-in-progress view with driver info)
- [x] Complaints review + resolution (status + response)
- [x] Supplier management (create, delete, approve/reject supplier requests)
- [x] Retailer list

## Phase 5 — Refinement 🟡 Partially done

- [x] Responsive behavior verified at desktop/tablet/mobile breakpoints (sidebar → drawer, tables → cards)
- [x] Loading states (skeletons) and empty/error states on every data-driven page
- [x] Form validation feedback (inline field errors) on join, create-offer, complaint, and admin decision forms
- [x] Manual end-to-end verification of core flows via headless browser (login per role, join-a-pool flow including validation, mobile drawer) — no console/runtime errors observed
- [ ] Accessibility pass (keyboard navigation, focus management in modals, ARIA labeling audit beyond the basics already in place)
- [ ] Automated test coverage (no test runner is configured yet)
- [ ] Performance pass (bundle is currently a single ~394 KB chunk — no route-based code splitting yet)
- [ ] Visual QA against the design reference images beyond the pages already spot-checked

## Not started — depends on the real backend

- [ ] Replace `src/mocks/api.ts` implementations with real HTTP calls once an API spec is available (see `docs/tech-stack.md` → "The mock data layer" for the intended integration seam)
- [ ] Real authentication (credentials, sessions/tokens) in place of the demo-account login
- [ ] Re-validate every status/enum in `src/types/domain.ts` against the backend's actual values rather than the assumed set used here

## Explicitly deferred (future scope, not started)

- Live map delivery tracking
- Automated complaint/support agent
- Advanced analytics/reporting
- Any feature requiring backend capabilities beyond what's described in `docs/project-scope.md`
