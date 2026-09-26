import { describe, expect, it } from "vitest";
import { poolQuantities } from "@/lib/utils";

describe("poolQuantities", () => {
  it("counts only paid quantity as collected, and the rest of the reservations as awaiting payment", () => {
    // 100 target, 30 still open to join → 70 reserved, of which 50 paid.
    expect(poolQuantities({ targetQuantity: 100, currentQuantity: 30, paidQuantity: 50 })).toEqual({
      paid: 50,
      awaitingPayment: 20,
    });
  });

  it("shows nothing awaiting payment once every reservation is paid", () => {
    expect(poolQuantities({ targetQuantity: 100, currentQuantity: 0, paidQuantity: 100 })).toEqual({
      paid: 100,
      awaitingPayment: 0,
    });
  });

  it("falls back to counting every reservation as collected on a legacy pool without paidQuantity", () => {
    expect(poolQuantities({ targetQuantity: 100, currentQuantity: 30 })).toEqual({
      paid: 70,
      awaitingPayment: 0,
    });
  });
});
