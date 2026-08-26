# Order Pool — Project Scope

## What Order Pool is

Order Pool is a multi-role wholesale group-purchasing platform. It connects **suppliers**, who offer products at large wholesale quantities, with **retailers**, who often only need a portion of that quantity. Rather than one retailer buying the full wholesale amount, Order Pool lets multiple retailers collectively fund a **Pool** until it reaches its target quantity, at which point the order is fulfilled and delivered.

Example: a supplier offers 1,000 units of a product. Retailer A needs 200, Retailer B needs 300, Retailer C needs 500. Together they fill the pool, it becomes **met**, and delivery begins.

This is not an e-commerce storefront — it's a coordination platform between three distinct roles, each with its own dashboard, permissions, and primary question:

- **Retailer**: "What can I buy at a good wholesale price, how much do I need to contribute, and when will I receive it?"
- **Supplier**: "Which of my pools are active, which are met, and what do I need to prepare or deliver?"
- **Administrator**: "What requires my attention right now?"

## Roles

| Role | Responsibility |
|---|---|
| **Retailer** | Browses pools, joins pools by contributing a quantity, tracks deliveries, files complaints. |
| **Supplier** | Submits wholesale offers, fulfills pools once met, tracks their own pool history. |
| **Administrator** | Reviews and decides on supplier offers, assigns deliveries, manages suppliers/retailers, resolves complaints. |

Role-specific functionality is hidden in the UI per role, but the UI hiding a control is not itself an authorization boundary — that responsibility belongs to the backend once one exists.

## Core domain concepts

- **Supplier Offer** — a supplier's proposed wholesale opportunity, awaiting administrator review. Statuses: `pending_review` → `negotiation` | `accepted` | `refused`.
- **Pool** — an accepted offer, now open for retailers to join. Fields include product, supplier, target quantity, current quantity, minimum contribution, unit price, start date, deadline, and status.
- **Pool status lifecycle**: `active` → `met` → `delivery_assigned` → `delivered` → `closed`.
- **Join** — a single retailer's participation record in a pool (quantity contributed, total price, join date). Conceptually similar to a cart line item, but a retailer can have many simultaneous joins across different pools.
- **Delivery** — created once a pool is met; tracks driver assignment, ETA, and status updates through to delivery.
- **Complaint** — filed by a retailer against a pool/delivery/general issue; administrators respond and resolve.

Terminology is used consistently throughout the product: **Pool** is the one central concept — never "order," "deal," "campaign," or "group order."

## Pool lifecycle (end to end)

1. Supplier submits an offer.
2. Administrator reviews: accept / request negotiation / refuse.
3. On accept, the offer becomes an active Pool, visible to retailers.
4. Retailers join, each contributing at least the pool's minimum contribution.
5. Once current quantity reaches target quantity, the pool becomes **met**.
6. Supplier is notified to prepare the order.
7. Administrator assigns a delivery (driver, ETA).
8. Retailers and administrators track delivery progress.
9. Once delivered, the pool is closed and becomes historical.

## Feature scope by role

### Retailer
- Browse and search active pools; view full pool detail (product, supplier, price, progress, minimum contribution, deadline, what happens after the pool is met).
- Join a pool with a contribution quantity (validated against minimum contribution and remaining capacity).
- **My Joins** — pools currently participating in, with contribution and pool status.
- **Track Deliveries** — delivery status for pools that have been met, through to delivered.
- **Complaints** — file a complaint, view history and admin responses.
- **Notifications** — pool status changes, pool met, delivery updates, system messages.
- **Profile** — business info, contact details.

### Supplier
- View own active pools and their progress.
- Submit new wholesale offers (sent to admin for review).
- View own offers and their review status (pending / negotiation / accepted / refused).
- **Pool History** — own pools that have been met, delivered, or closed.
- **Notifications** — offer decisions, "prepare for delivery" alerts.
- **Profile** — company info, verification status.

### Administrator
- **Supplier Offers** — review queue with accept / request-negotiation / refuse actions.
- **Offers History** — previously decided offers.
- **Active Pools** — all pools across all suppliers.
- **Met Pools** — pools ready for delivery assignment (assign driver, phone, ETA).
- **Pool History** — delivered/closed pools across the platform.
- **Track Pools** — pools currently in delivery, with assigned driver.
- **Complaints** — review and resolve retailer complaints.
- **Suppliers** — list, create, delete suppliers; review requests from users wanting to become suppliers.
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

The backend (once available) is the source of truth for entities, validation, relationships, authorization, and statuses. This frontend does not invent endpoints, fields, or business rules — where the current build uses mock data (see `docs/tech-stack.md`), it mirrors the shapes described in this scope document rather than convenient UI-only shortcuts, specifically so swapping in the real API is a narrow, mechanical change.

## Current scope vs. future scope

**In scope now**: authentication, role-based dashboards, the full supplier/retailer/admin workflows described above, notifications, complaints, profiles, and delivery tracking at the level described here.

**Explicitly out of scope until requested**: live map tracking, advanced delivery tracking beyond status + ETA, automated complaint/support agents, advanced analytics, and any other feature that would require backend capabilities not described above.
