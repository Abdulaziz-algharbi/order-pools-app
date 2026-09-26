import { describe, expect, it } from "vitest";
import { checkPoolPricing, omrPriceError } from "@/lib/pool-pricing";

describe("checkPoolPricing", () => {
  it("explains the provider minimum before a price is entered", () => {
    expect(checkPoolPricing("", "")).toEqual({
      hint: expect.stringContaining("0.100 OMR or more"),
    });
  });

  it("tells the admin the smallest minimum contribution once the price is known", () => {
    expect(checkPoolPricing("0.001", "")).toEqual({
      hint: "At 0.001 OMR per unit, set at least 100 so each join reaches the payment provider's 0.100 OMR minimum.",
    });
  });

  it("flags a minimum contribution whose cost is under 0.100 OMR, with the minimum that would work", () => {
    expect(checkPoolPricing("0.001", "10")).toEqual({
      field: "minimumContribution",
      error:
        "A minimum join would cost 0.010 OMR, but the payment provider requires at least 0.100 OMR. Set at least 100.",
    });
  });

  it("accepts a minimum that exactly reaches 0.100 OMR and shows what a join costs", () => {
    expect(checkPoolPricing("0.001", "100")).toEqual({ hint: "Each join costs at least 0.100 OMR." });
    expect(checkPoolPricing("0.35", "1")).toEqual({ hint: "Each join costs at least 0.350 OMR." });
  });

  it.each(["0.0005", "1.2345"])("flags a price of %s OMR, which is finer than 1 baisa", (price) => {
    expect(checkPoolPricing(price, "100")).toMatchObject({ field: "pricePerUnit" });
  });
});

describe("omrPriceError", () => {
  it("accepts prices in whole baisa", () => {
    expect(omrPriceError("0.001")).toBeNull();
    expect(omrPriceError("12.345")).toBeNull();
  });

  it.each(["", "0", "-1"])("asks for a positive price for %j", (input) => {
    expect(omrPriceError(input)).toBe("Enter a price greater than 0.");
  });

  it.each(["0.0005", "1.2345"])("rejects %s OMR, which is finer than 1 baisa", (input) => {
    expect(omrPriceError(input)).toContain("at least 0.001 OMR");
  });
});
