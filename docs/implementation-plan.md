# Order Pool — Implementation Plan

> Status as of 2026-09-13. This tracks the phased build-out described in `docs/project-scope.md`. Phases 1–4 are now against the real `order-pools-backend` API, not mock data — re-verify against the code before treating a line here as still accurate.

## Phase 1 — Foundation ✅ Done

- [x] Project scaffold (Vite + React 19 + TypeScript + Tailwind v4)
- [x] Design system tokens (colors, Geist/Inter fonts) wired into Tailwind's `@theme`
- [x] Routing skeleton (`react-router` data router, role-scoped route trees)
- [x] Real authentication (`AuthContext`, JWT access/refresh tokens, signup + login pages)
- [x] Role-based route guards (`ProtectedRoute`)
- [x] Responsive app shell: fixed sidebar (desktop) / drawer (mobile), topbar with notification dropdown and profile menu
- [x] Reusable UI kit: Button, LinkButton, Card, StatusBadge, ProgressBar, Modal, DataTable (responsive card fallback), Pagination, EmptyState, ErrorState, Spinner/Skeleton, form fields
- [x] Real API client (`src/mocks/api.ts` — name predates the backend integration) against every service `order-pools-backend` exposes

## Phase 2 — Retailer ✅ Done

- [x] Browse pools (role-scoped to `OPEN` pools, plus any the retailer has already joined)
- [x] Pool detail page (product, supplier, price, progress, minimum contribution, deadline, "what happens next")
- [x] Join a pool (quantity validation against minimum contribution and remaining capacity) → real Thawani checkout redirect, with `PaymentResultPage` reconciling on return
- [x] My Joins (contribution, pool progress, payment status per join), with resume-checkout/cancel-payment and leave-pool actions
- [x] Track Deliveries (status through to delivered)
- [x] Complaints (create, edit, view history and responses)
- [x] Notifications (dropdown + dedicated page, mark read/mark all read, resyncs from the server if a mark-read call fails)
- [x] Profile (edit details, address book, become-a-supplier request, account deletion)

## Phase 3 — Supplier ✅ Done

- [x] Dashboard (offers awaiting decision, pools nearing fulfillment)
- [x] Active pools list + read-only detail view
- [x] Create offer (validated form: quantity, price, unit)
- [x] Offer list + detail, with edit/withdraw while still under review, and admin decision/notes surfaced
- [x] Pool history (completed/cancelled pools for this supplier)
- [x] Payouts (read-only, role-scoped to this supplier's own)
- [x] Notifications (shared page/component with retailer)
- [x] Profile (edit details, address book, account-closure request)

## Phase 4 — Administrator ✅ Done

- [x] Dashboard organized around pending actions (offers to review, pools ready for delivery, open complaints, pending supplier requests)
- [x] Supplier offer review queue (status `PATCH` — no dedicated approve/negotiate/reject actions yet, see "Not yet built" below)
- [x] Offers history
- [x] Active pools (all suppliers), pool detail with delivery assignment/progression and force-expire for a stalled pool
- [x] Met pools + delivery assignment
- [x] Pool history (all suppliers)
- [x] Track pools (delivery-in-progress view)
- [x] Complaints review + resolution (status + response)
- [x] Payments (platform-wide, with refund retry/confirm follow-up)
- [x] Payouts (record manual transfer status/reference)
- [x] Supplier management (create, delete, approve/reject supplier requests, approve/reject account-removal requests)
- [x] Retailer list

## Phase 5 — Refinement 🟡 Partially done

- [x] Responsive behavior verified at desktop/tablet/mobile breakpoints (sidebar → drawer, tables → cards)
- [x] Loading states (skeletons) and empty/error states on every data-driven page
- [x] Form validation feedback (inline field errors) on every form
- [x] Manual end-to-end verification of every flow above against a real running backend in a browser (not just the mock-data era's headless walkthrough) — see individual PR/commit descriptions for what was exercised
- [ ] Accessibility pass (keyboard navigation, focus management in modals, ARIA labeling audit beyond the basics already in place)
- [ ] Automated test coverage (no test runner is configured yet)
- [ ] Performance pass (bundle is currently a single ~120 KB gzipped chunk — no route-based code splitting yet)
- [ ] Visual QA against the design reference images beyond the pages already spot-checked

## Not yet built (backend supports it or could easily; frontend doesn't cover it yet)

These mirror gaps in `order-pools-backend`'s own `docs/unimplemented-features.md` — the frontend doesn't get ahead of the backend on any of these:

- No dedicated "approve offer → create pool" atomic action — still two separate admin steps.
- No dedicated "request negotiation" / "reject with reason" actions for offers — just a direct status `PATCH`.
- No `SUPPLIER`-visible "participants of my own pool" listing.
- No complaint conversation/message thread (a complaint's `resolution` is one free-text field).
- No notification coverage for offer/supplier-request/removal-request/complaint events — only delivery-assignment and the three payment events currently drive one.

## Explicitly deferred (future scope, not started)

- Live map delivery tracking
- Automated complaint/support agent
- Advanced analytics/reporting
- Any feature requiring backend capabilities beyond what `order-pools-backend` exposes today
