import { describe, expect, it } from "vitest";
import {
  allowedJoinQuantities,
  belowCostIssue,
  breakEvenMinimumPriceBaisa,
  checkPoolPricing,
  contributionBaisa,
  formatOmr,
  joinQuantityIssue,
  minimumPriceIssue,
  omrPriceError,
  poolTermsErrors,
  toBaisa,
} from "@/lib/pool-pricing";

// The same cases as the backend's tests/services/pool.pricing.test.ts, so
// the two copies can't drift. Reference scenario
// (order-pools-backend/docs/pricing-model-plan.md): 100 units for 1000 OMR,
// sold in lots of 25.
const offer = { wholeQuantity: 100, totalWholesalePrice: 1000 };

describe("toBaisa / formatOmr", () => {
  it.each([
    [12.345, 12345],
    [0.1, 100],
    [250, 250000],
  ])("converts %s OMR to %s baisa", (omr, baisa) => {
    expect(toBaisa(omr)).toBe(baisa);
  });

  it.each([
    [250000, "250.000"],
    [100, "0.100"],
    [1, "0.001"],
  ])("formats %s baisa as %s", (baisa, text) => {
    expect(formatOmr(baisa)).toBe(text);
  });
});

describe("breakEvenMinimumPriceBaisa", () => {
  it("is 250.000 OMR for 25 of 100 units costing 1000 OMR", () => {
    expect(breakEvenMinimumPriceBaisa(offer, 25)).toBe(250000);
  });

  it("rounds a fraction of a baisa up", () => {
    expect(breakEvenMinimumPriceBaisa({ wholeQuantity: 100, totalWholesalePrice: 1000.001 }, 25)).toBe(250001);
  });
});

describe("belowCostIssue", () => {
  it.each([300, 250])("accepts %s OMR per 25 units", (price) => {
    expect(belowCostIssue(offer, 25, price)).toBeNull();
  });

  it.each([249.999, 200])("rejects %s OMR per 25 units, naming the break-even", (price) => {
    expect(belowCostIssue(offer, 25, price)).toBe(
      `minimumContributionPrice (${price.toFixed(3)} OMR) cannot be below the supplier-cost break-even of 250.000 OMR for 25 units`,
    );
  });

  // 0.009 * 3 < 0.027 in floating point, though the two are equal.
  it("compares in baisa, so float noise cannot reject a price exactly at cost", () => {
    expect(belowCostIssue({ wholeQuantity: 3, totalWholesalePrice: 0.027 }, 1, 0.009)).toBeNull();
  });
});

describe("poolTermsErrors", () => {
  it("accepts terms that fit the offer and cover its cost", () => {
    expect(poolTermsErrors(offer, 25, 300)).toBeNull();
  });

  it("puts a minimum over the offer's quantity on minimumContribution", () => {
    expect(poolTermsErrors(offer, 101, 300)).toEqual({
      minimumContribution: ["minimumContribution cannot exceed the offer's quantity (100)"],
    });
  });

  it("puts a below-cost price on minimumContributionPrice", () => {
    expect(poolTermsErrors(offer, 25, 200)).toEqual({
      minimumContributionPrice: [expect.stringContaining("break-even of 250.000 OMR")],
    });
  });

  // 100 isn't a multiple of 30: allowed, the last joiner takes the leftover.
  it("accepts a minimum that doesn't divide the offer's quantity", () => {
    expect(poolTermsErrors(offer, 30, 300)).toBeNull();
  });
});

describe("minimumPriceIssue", () => {
  it.each([0.1, 300])("accepts %s OMR", (price) => {
    expect(minimumPriceIssue(price)).toBeNull();
  });

  it("rejects 0.099 OMR, below the payment provider's minimum", () => {
    expect(minimumPriceIssue(0.099)).toBe(
      "minimumContributionPrice (0.099 OMR) must be at least 0.100 OMR (the payment provider's minimum)",
    );
  });
});

describe("joinQuantityIssue", () => {
  it("rejects 30 in lots of 25, saying what can be taken", () => {
    expect(joinQuantityIssue({ minimumContribution: 25, currentQuantity: 100 }, 30)).toBe(
      "quantity (30) is not a multiple of the minimum contribution (25) — take a multiple of 25 up to 75, or all 100 still free",
    );
  });

  it("rejects 90 in lots of 30, which would strand the last 10", () => {
    expect(joinQuantityIssue({ minimumContribution: 30, currentQuantity: 100 }, 90)).toBe(
      "quantity (90) would leave 10, less than the minimum contribution (30), which nobody could join — take a multiple of 30 up to 60, or all 100 still free",
    );
  });

  it("names the single lot when only one can be taken", () => {
    expect(joinQuantityIssue({ minimumContribution: 30, currentQuantity: 70 }, 40)).toBe(
      "quantity (40) is not a multiple of the minimum contribution (30) — take 30, or all 70 still free",
    );
  });

  it("rejects more than is still free", () => {
    expect(joinQuantityIssue({ minimumContribution: 25, currentQuantity: 50 }, 75)).toBe(
      "quantity (75) cannot exceed what is still free in the pool (50)",
    );
  });
});

describe("allowedJoinQuantities", () => {
  it.each([
    [25, 100, [25, 50, 75, 100]],
    [30, 100, [30, 60, 100]],
    [30, 70, [30, 70]],
    [30, 40, [40]],
    [2, 5, [2, 5]],
    [25, 0, []],
  ])("in lots of %s with %s free, offers %j", (minimumContribution, currentQuantity, sizes) => {
    expect(allowedJoinQuantities({ minimumContribution, currentQuantity })).toEqual(sizes);
  });

  // The picker must offer exactly what the backend will accept.
  it.each([
    [25, 100],
    [30, 100],
    [7, 50],
    [1, 12],
    [10, 10],
  ])("matches joinQuantityIssue for lots of %s with %s free", (minimumContribution, currentQuantity) => {
    const pool = { minimumContribution, currentQuantity };
    const accepted = Array.from({ length: currentQuantity }, (_, i) => i + 1).filter(
      (quantity) => joinQuantityIssue(pool, quantity) === null,
    );
    expect(allowedJoinQuantities(pool)).toEqual(accepted);
  });
});

describe("contributionBaisa", () => {
  it.each([
    [25, 300000],
    [50, 600000],
    [100, 1200000],
  ])("charges %s units at 300 OMR per 25 as %s baisa", (quantity, baisa) => {
    expect(contributionBaisa({ minimumContribution: 25, minimumContributionPrice: 300 }, quantity)).toBe(baisa);
  });

  it.each([
    [30, 300000],
    [40, 400000],
    [100, 1000000],
  ])("charges %s units at 300 OMR per 30, the leftover pro rata, as %s baisa", (quantity, baisa) => {
    expect(contributionBaisa({ minimumContribution: 30, minimumContributionPrice: 300 }, quantity)).toBe(baisa);
  });

  it("rounds the leftover's share up to the baisa", () => {
    expect(contributionBaisa({ minimumContribution: 30, minimumContributionPrice: 100.001 }, 40)).toBe(133335);
  });

  // 3 * 0.1 is 0.30000000000000004 in floating point.
  it("stays exact where OMR floats would not", () => {
    expect(contributionBaisa({ minimumContribution: 1, minimumContributionPrice: 0.1 }, 3)).toBe(300);
  });
});


// The old per-unit check, until AdminOffersPage moves over (F4).
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
