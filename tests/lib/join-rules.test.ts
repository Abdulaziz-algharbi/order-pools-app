import { describe, expect, it } from "vitest";
import { canLeaveJoin, joinBadgeStatus, tracksPoolDelivery } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date().toISOString();

describe("canLeaveJoin", () => {
  it.each(["PENDING_PAYMENT", "WAITING"] as const)("lets an active %s join leave an OPEN pool", (status) => {
    expect(canLeaveJoin({ status }, { status: "OPEN", updatedAt: now })).toBe(true);
  });

  // The backend would delete the record instead of withdrawing — and a
  // withdrawn join has nothing left to leave.
  it.each(["WITHDRAWN", "PAYMENT_FAILED", "REFUNDED"] as const)(
    "offers no Leave for a %s join on an OPEN pool",
    (status) => {
      expect(canLeaveJoin({ status }, { status: "OPEN", updatedAt: now })).toBe(false);
    },
  );

  it("keeps the pool-status rules once the pool is past OPEN", () => {
    expect(canLeaveJoin({ status: "DELIVERED" }, { status: "COMPLETED", updatedAt: now })).toBe(true);
    expect(canLeaveJoin({ status: "WAITING" }, { status: "DISTRIBUTING", updatedAt: now })).toBe(false);
    const cancelledLongAgo = new Date(Date.now() - 8 * DAY_MS).toISOString();
    expect(canLeaveJoin({ status: "REFUNDED" }, { status: "CANCELLED", updatedAt: cancelledLongAgo })).toBe(true);
  });
});

describe("tracksPoolDelivery", () => {
  it.each(["WAITING", "DELIVERED"] as const)("tracks a pool a %s participant paid into", (status) => {
    expect(tracksPoolDelivery({ status }, { status: "DISTRIBUTING" })).toBe(true);
  });

  it.each(["WITHDRAWN", "PAYMENT_FAILED", "PENDING_PAYMENT"] as const)(
    "does not track a pool for a %s join — it isn't part of the order",
    (status) => {
      expect(tracksPoolDelivery({ status }, { status: "DISTRIBUTING" })).toBe(false);
    },
  );

  it("tracks a cancelled pool its participant was refunded from", () => {
    expect(tracksPoolDelivery({ status: "REFUNDED" }, { status: "CANCELLED" })).toBe(true);
  });

  it("does not track a pool that went on without a refunded participant", () => {
    expect(tracksPoolDelivery({ status: "REFUNDED" }, { status: "TARGET_REACHED" })).toBe(false);
  });
});

describe("joinBadgeStatus", () => {
  it("shows the participant's own status while no refund is under way", () => {
    expect(joinBadgeStatus({ status: "WAITING" }, { status: "COMPLETED" })).toBe("WAITING");
    expect(joinBadgeStatus({ status: "WITHDRAWN" }, { status: "FAILED" })).toBe("WITHDRAWN");
    expect(joinBadgeStatus({ status: "WITHDRAWN" })).toBe("WITHDRAWN");
  });

  // The participant stays WITHDRAWN (history); the refund's progress is on
  // the payment.
  it.each([
    ["REFUND_PENDING", "WITHDRAWN_REFUND_PENDING"],
    ["REFUNDED", "WITHDRAWN_REFUNDED"],
    ["REFUND_FAILED", "WITHDRAWN_REFUND_FAILED"],
  ] as const)("follows a withdrawn join's %s refund", (paymentStatus, expected) => {
    expect(joinBadgeStatus({ status: "WITHDRAWN" }, { status: paymentStatus })).toBe(expected);
  });

  // A paid participant stays WAITING until an expired pool's refund completes.
  it("shows an expired pool's pending refund instead of 'awaiting delivery'", () => {
    expect(joinBadgeStatus({ status: "WAITING" }, { status: "REFUND_PENDING" })).toBe("REFUND_PENDING");
  });
});
