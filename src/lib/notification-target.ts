/**
 * Where clicking a notification takes the user. The backend sends what a
 * notification is about (`resource`), never a URL — routes are ours, so
 * this table is the one place that turns a notification into a page.
 *
 * Keyed by every NotificationType (TypeScript refuses a type with no
 * entry), each entry names the resource type it expects and, per panel,
 * the page for that resource. A panel with no page, a missing resource
 * (an admin's free-form notice, or one created before resources existed)
 * or an unexpected resource type all mean "nothing to open": the
 * notification is just marked read.
 *
 * The query parameters (?pool=, ?offer=, ?request=) tell the page which
 * item to bring into view.
 */
import type { Panel } from "@/lib/panel";
import type { AppNotification, NotificationResourceType, NotificationType } from "@/types/domain";

type PageFor = Partial<Record<Panel, (id: string) => string>>;

interface Target {
  resource: NotificationResourceType;
  pages: PageFor;
}

// The retailer's join in the pool: where its payment and refund are shown.
const RETAILER_JOIN: Target = {
  resource: "POOL",
  pages: { retailer: (id) => `/retailer/joins?pool=${id}` },
};

// An offer an admin should review.
const ADMIN_OFFER_REVIEW: Target = {
  resource: "PRODUCT_OFFER",
  pages: { admin: (id) => `/admin/offers?offer=${id}` },
};

// The supplier's own offer, with the admin's note.
const SUPPLIER_OFFER: Target = {
  resource: "PRODUCT_OFFER",
  pages: { supplier: (id) => `/supplier/offers/${id}` },
};

const TARGETS: Record<NotificationType, Target> = {
  PAYMENT_COMPLETED: RETAILER_JOIN,
  PAYMENT_FAILED: RETAILER_JOIN,
  PAYMENT_REFUND_REQUESTED: RETAILER_JOIN,
  PAYMENT_REFUNDED: RETAILER_JOIN,
  DELIVERY_ASSIGNED: {
    resource: "POOL",
    pages: {
      retailer: (id) => `/retailer/track?pool=${id}`,
      supplier: (id) => `/supplier/pools/${id}`,
      admin: (id) => `/admin/pools/${id}`,
    },
  },
  SUPPLIER_REQUEST_CREATED: {
    resource: "SUPPLIER_REQUEST",
    pages: { admin: (id) => `/admin/suppliers?request=${id}` },
  },
  SUPPLIER_REQUEST_APPROVED: {
    resource: "SUPPLIER_REQUEST",
    pages: {
      // The session may predate the approval; the profile's supplier card
      // refreshes it before opening the supplier panel.
      retailer: () => "/retailer/profile",
      supplier: () => "/supplier",
    },
  },
  SUPPLIER_REQUEST_REJECTED: {
    resource: "SUPPLIER_REQUEST",
    pages: { retailer: () => "/retailer/profile" },
  },
  PRODUCT_OFFER_SUBMITTED: ADMIN_OFFER_REVIEW,
  PRODUCT_OFFER_REVISED: ADMIN_OFFER_REVIEW,
  // Points at the pool the approval opened.
  PRODUCT_OFFER_APPROVED: {
    resource: "POOL",
    pages: { supplier: (id) => `/supplier/pools/${id}` },
  },
  PRODUCT_OFFER_CHANGES_REQUESTED: SUPPLIER_OFFER,
  PRODUCT_OFFER_REJECTED: SUPPLIER_OFFER,
  // A full pool waiting for its delivery to be started.
  POOL_TARGET_REACHED: {
    resource: "POOL",
    pages: { admin: (id) => `/admin/met-pools?pool=${id}` },
  },
};

/** The page to open for `notification` in `panel`, or null for none. */
export function notificationTarget(notification: AppNotification, panel: Panel): string | null {
  const target = TARGETS[notification.type];
  const resource = notification.resource;
  if (!target || !resource || resource.type !== target.resource) return null;
  return target.pages[panel]?.(resource.id) ?? null;
}
