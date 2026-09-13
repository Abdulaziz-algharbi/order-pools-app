# Order Pool — Project Scope

> Derived from `src/types/domain.ts`, `src/pages/`, and the sibling `order-pools-backend` repo on 2026-09-13. This is a snapshot — re-verify against the code (and the backend's own `docs/project-scope.md`, the actual source of truth for entities and business rules) before relying on it for anything load-bearing.

## What Order Pool is

Order Pool is a multi-role wholesale group-purchasing platform. It connects **suppliers**, who offer products at large wholesale quantities, with **retailers**, who often only need a portion of that quantity. Rather than one retailer buying the full wholesale amount, Order Pool lets multiple retailers collectively fund a **Pool** until it reaches its target quantity, at which point an administrator arranges delivery and the supplier is paid.

Example: a supplier's approved offer is built into a pool needing 1,000 units. Retailer A joins for 200, Retailer B for 300, Retailer C for 500. Together they fill the pool (`TARGET_REACHED`), an admin assigns and progresses delivery (`DISTRIBUTING` → `COMPLETED`), and a payout for the supplier is created automatically.

This is not an e-commerce storefront — it's a coordination platform between three roles, each with its own dashboard and permissions, backed by a real API (`order-pools-backend`) that owns every business rule, validation, and authorization decision. This frontend does not invent any of those — it renders and calls what the backend actually exposes.

## Roles

| Role | Responsibility |
|---|---|
| **Retailer** | Browses `OPEN` pools, joins one by contributing a quantity and paying via Thawani, tracks deliveries, files complaints, can request to also become a supplier. Default role on signup. |
| **Supplier** | Submits wholesale offers for admin approval, sees pools built from their own offers, tracks payouts owed to them. Granted additively onto an existing account (via an admin-approved `SupplierRequest`) — never replaces `RETAILER`. |
| **Administrator** | Approves/rejects offers, creates pools from approved offers, assigns and progresses deliveries, can force-expire a stalled pool, records supplier payouts and payment refund follow-up, reviews supplier and account-removal requests, manages supplier/retailer accounts, resolves complaints. |

A single account can hold more than one role at once (most commonly `RETAILER` + `SUPPLIER`) — `AppUser.roles` is a real array, not a discriminant. The UI hides controls per role for usability, but that is never the authorization boundary; the backend enforces role/ownership on every request independently of what the UI shows.

## Core domain concepts

Entity shapes mirror `order-pools-backend` exactly (see its `docs/project-scope.md` for full detail) — summarized here:

- **ProductOffer** — a supplier's wholesale listing, awaiting admin review. `status`: `PENDING` → `NEGOTIATION` | `APPROVED` | `REJECTED`. Only visible to its owning supplier and admins; a retailer never sees an offer directly (see Pool below). A `REJECTED` offer auto-deletes 7 days later.
- **Pool** — created by an admin from an `APPROVED` offer; the offer's display fields (name, description, image, unit) and its supplier's name are snapshotted onto the pool at creation, since a retailer has no read access to the offer itself. `status`: `OPEN` → `TARGET_REACHED` → `DISTRIBUTING` → `COMPLETED`, or `OPEN` → `CANCELLED` (admin-forced, only past its `endDate`). `currentQuantity` counts *down* from `targetQuantity` as retailers join.
- **PoolParticipant** — one retailer's claim on a pool's quantity. `status`: `PENDING_PAYMENT` → `WAITING` → `DELIVERED`, or `PAYMENT_FAILED` / `REFUNDED` off the happy path. A retailer may withdraw (releasing their claim, refunding a completed payment) while the pool is still `OPEN`, once it's `COMPLETED`, or 7+ days after it was `CANCELLED`.
- **Payment** — one per participant, via a real Thawani hosted-checkout session. `status`: `PENDING` → `COMPLETED` → `REFUND_PENDING` → `REFUNDED`, or → `FAILED` / `REFUND_FAILED` off the happy path. A `PENDING` payment carries a re-derivable `checkoutUrl` for resuming an abandoned checkout.
- **Delivery** — one per pool (created only once `TARGET_REACHED`). `deliveryStatus`: `PENDING` → `DELIVERING` → `DELIVERED`. Reaching `DELIVERED` also flips the pool to `COMPLETED` and every `WAITING` participant to `DELIVERED`, and auto-creates a `SupplierPayout`.
- **SupplierPayout** — one per pool, auto-created once its delivery completes. `amount` is fixed to the offer's agreed wholesale price (never derived from actual retailer payments). `status`: `PENDING` → `PROCESSING` → `COMPLETED` | `FAILED` — an admin records the actual bank transfer manually; there is no automated vendor-payout API.
- **Complaint** — filed by whichever retailer or supplier is affected, against a pool. `status`: `OPEN` → `'UNDER REVIEW'` → `RESOLVED`. The filer may edit `title`/`description`/`priority` any time; only an admin sets `status`/`resolution`.
- **SupplierRequest** — a retailer's request to also become a supplier. `status`: `PENDING` → `APPROVED` | `REJECTED`. Approving grants `SUPPLIER` additively.
- **SupplierRemoveRequest** — created as a side effect of a supplier-holding account calling account removal (never posted directly). `status`: `PENDING` → `APPROVED` | `REJECTED`. Approving deletes the account outright.
- **Address** — not role-specific; owned via `User.addresses[]`. A retailer needs at least one to join a pool; a new account needs at least one to register at all.

Terminology is used consistently throughout the product: **Pool** is the one central concept — never "order," "deal," "campaign," or "group order."

## Pool lifecycle (end to end)

1. Supplier submits a `ProductOffer`.
2. Admin approves it (or rejects it — there's no dedicated "request negotiation" action on either side yet, just a direct status `PATCH`).
3. Admin creates a `Pool` from the approved offer (a separate, manual step — not yet linked automatically to approval).
4. Retailers join, each paying their contribution via a real Thawani checkout redirect. A join atomically reserves quantity; the pool flips to `TARGET_REACHED` the instant it's exactly filled.
5. Admin assigns a `Delivery` (pool flips to `DISTRIBUTING`), then progresses it through to `DELIVERED` (pool flips to `COMPLETED`, every `WAITING` participant flips to `DELIVERED`).
6. A `SupplierPayout` is auto-created; an admin records the actual transfer once made.
7. If a pool never fills before its `endDate`, an admin can force-expire it — it cancels, sweeps pending payments to failed, and requests a refund for every completed one.

## Feature scope by role (as currently built)

### Retailer
- Browse `OPEN` pools; view full pool detail (product, supplier, price, progress, minimum contribution, deadline, "what happens after the pool is met").
- Join a pool with a contribution quantity (validated against minimum contribution and remaining capacity) → real Thawani checkout redirect.
- **My Joins** — every pool participated in, with contribution, pool progress, and payment status. A `PENDING` payment gets "Resume checkout" / "Cancel" actions; an eligible participant gets a "Leave" action.
- **Track Deliveries** — delivery status for pools that have reached their target, through to delivered.
- **Complaints** — file, edit, and view responses.
- **Notifications** — delivery/payment events, with per-recipient read state.
- **Profile** — edit name/phone/company/password, manage saved addresses, request to become a supplier (with status shown once filed), delete account.

### Supplier
- View own active pools and their progress.
- Submit new wholesale offers; edit or withdraw one while it's still `PENDING`/`NEGOTIATION`.
- View own offers and their review status, including any admin note.
- **Pool History** — own pools that have reached `COMPLETED`/`CANCELLED`.
- **Payouts** — read-only view of what's owed and its payment status.
- **Notifications** — shared page/component with retailer.
- **Profile** — same edit/address-book actions as retailer, plus account closure (opens an admin-reviewed request rather than deleting immediately, since a supplier may have open pools/payouts).

### Administrator
- **Supplier Offers** / **Offers History** — review queue and past decisions (status `PATCH` only — no dedicated approve/negotiate/reject actions yet).
- **Active Pools** / **Met Pools** / **Pool History** — pools across all suppliers by lifecycle stage; a pool detail page assigns/progresses delivery and can force-expire a stalled `OPEN` pool past its deadline.
- **Track Pools** — pools currently in delivery.
- **Complaints** — review and resolve.
- **Payments** — every payment platform-wide, with refund follow-up (retry a failed refund, confirm a pending one completed).
- **Payouts** — record a supplier payout's manual transfer status and reference.
- **Suppliers** — list, create, delete supplier accounts; review pending supplier requests and account-removal requests.
- **Retailers** — view all registered retailers.

## Design goals

The product should read as a real operational business platform, not a demo:

- Clear information hierarchy and status indicators.
- A pool card should convey product, price, current/target quantity, progress, minimum contribution, deadline, status, and primary action at a glance.
- Explicit loading, empty, and error states everywhere data is fetched.
- Form validation feedback that's specific and actionable.
- Dashboards organized around pending actions and exceptions, not just data tables.

## Responsive requirements

Supported breakpoints: desktop (~1280px), tablet (~768px), mobile (~360px). Tables become stacked cards on mobile rather than shrinking; the sidebar becomes a drawer; touch targets remain usable throughout.

## Visual design reference

`docs/design/order-pool-product-reference.png` (layout/UX direction) and `docs/design/order-pool-design-system.png` (colors, typography) are the source of truth for visual language:

- Primary `#0F172A`, Secondary `#10B981`, Tertiary `#6366F1`, Neutral `#F8FAFC`
- Headings: Geist · Body: Inter

## Backend integration principle

`order-pools-backend` is the source of truth for entities, validation, relationships, authorization, and statuses. This frontend does not invent endpoints, fields, or business rules — where a capability doesn't exist on the backend yet (e.g. a dedicated "request negotiation" action, or linking offer approval directly to pool creation), the frontend doesn't fake it either; see `docs/implementation-plan.md` for the current list of such gaps.

## Explicitly out of scope (for now)

Live map delivery tracking, automated complaint/support agents, advanced analytics/reporting, and any feature that would require backend capabilities `order-pools-backend` doesn't expose yet.
