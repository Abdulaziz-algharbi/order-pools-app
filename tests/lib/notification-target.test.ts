import { matchRoutes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { notificationTarget } from "@/lib/notification-target";
import type { Panel } from "@/lib/panel";
import { router } from "@/routes/router";
import type {
  AppNotification,
  NotificationResource,
  NotificationType,
} from "@/types/domain";

function notification(type: NotificationType, resource: NotificationResource | null | undefined): AppNotification {
  return {
    _id: "n1",
    recipients: [],
    type,
    title: "t",
    message: "m",
    resource,
    priority: "NORMAL",
    createdAt: "2026-10-14T00:00:00.000Z",
    updatedAt: "2026-10-14T00:00:00.000Z",
  };
}

const pool = { type: "POOL", id: "pool-1" } as const;
const offer = { type: "PRODUCT_OFFER", id: "offer-1" } as const;
const request = { type: "SUPPLIER_REQUEST", id: "req-1" } as const;

// Every notification type, with the resource the backend sends it, and the
// page it opens in each panel (null: nothing to open there).
const CASES: [NotificationType, NotificationResource, Record<Panel, string | null>][] = [
  ["PAYMENT_COMPLETED", pool, { retailer: "/retailer/joins?pool=pool-1", supplier: null, admin: null }],
  ["PAYMENT_FAILED", pool, { retailer: "/retailer/joins?pool=pool-1", supplier: null, admin: null }],
  ["PAYMENT_REFUND_REQUESTED", pool, { retailer: "/retailer/joins?pool=pool-1", supplier: null, admin: null }],
  ["PAYMENT_REFUNDED", pool, { retailer: "/retailer/joins?pool=pool-1", supplier: null, admin: null }],
  [
    "DELIVERY_ASSIGNED",
    pool,
    { retailer: "/retailer/track?pool=pool-1", supplier: "/supplier/pools/pool-1", admin: "/admin/pools/pool-1" },
  ],
  ["SUPPLIER_REQUEST_CREATED", request, { retailer: null, supplier: null, admin: "/admin/suppliers?request=req-1" }],
  ["SUPPLIER_REQUEST_APPROVED", request, { retailer: "/retailer/profile", supplier: "/supplier", admin: null }],
  ["SUPPLIER_REQUEST_REJECTED", request, { retailer: "/retailer/profile", supplier: null, admin: null }],
  ["PRODUCT_OFFER_SUBMITTED", offer, { retailer: null, supplier: null, admin: "/admin/offers?offer=offer-1" }],
  ["PRODUCT_OFFER_REVISED", offer, { retailer: null, supplier: null, admin: "/admin/offers?offer=offer-1" }],
  ["PRODUCT_OFFER_APPROVED", pool, { retailer: null, supplier: "/supplier/pools/pool-1", admin: null }],
  ["PRODUCT_OFFER_CHANGES_REQUESTED", offer, { retailer: null, supplier: "/supplier/offers/offer-1", admin: null }],
  ["PRODUCT_OFFER_REJECTED", offer, { retailer: null, supplier: "/supplier/offers/offer-1", admin: null }],
  ["POOL_TARGET_REACHED", pool, { retailer: null, supplier: null, admin: "/admin/met-pools?pool=pool-1" }],
  ["POOL_EXPIRED", pool, { retailer: null, supplier: "/supplier/pools/pool-1", admin: null }],
  ["POOL_CANCELLED", pool, { retailer: null, supplier: "/supplier/pools/pool-1", admin: null }],
];

const PANELS: Panel[] = ["retailer", "supplier", "admin"];

describe("notificationTarget", () => {
  it.each(CASES.flatMap(([type, resource, pages]) => PANELS.map((panel) => [type, panel, resource, pages[panel]] as const)))(
    "opens %s in the %s panel at the right page",
    (type, panel, resource, expected) => {
      expect(notificationTarget(notification(type, resource), panel)).toBe(expected);
    },
  );

  // A route renamed in router.tsx must fail here, not leave a dead link.
  it.each(CASES.flatMap(([type, , pages]) => Object.values(pages).filter(Boolean).map((path) => [type, path!] as const)))(
    "%s opens %s, a page the router has",
    (_type, path) => {
      const matches = matchRoutes(router.routes, path.split("?")[0]);
      expect(matches?.at(-1)?.route.path).not.toBe("*");
    },
  );

  it.each([
    ["no resource", undefined],
    ["a null resource", null],
  ])("opens nothing for a notification with %s", (_label, resource) => {
    expect(notificationTarget(notification("PAYMENT_COMPLETED", resource), "retailer")).toBeNull();
  });

  it("opens nothing for a resource of a type it doesn't expect", () => {
    expect(notificationTarget(notification("PAYMENT_COMPLETED", offer), "retailer")).toBeNull();
  });

  // A type a newer backend sends before this frontend knows it.
  it("opens nothing for an unknown notification type", () => {
    const unknown = notification("SOMETHING_NEW" as NotificationType, pool);
    expect(notificationTarget(unknown, "retailer")).toBeNull();
  });
});
