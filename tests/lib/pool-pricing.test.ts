import { describe, expect, it } from "vitest";
import {
  allowedJoinQuantities,
  approxUnitPriceBaisa,
  belowCostIssue,
  breakEvenMinimumPriceBaisa,
  checkApproveTerms,
  contributionBaisa,
  formatOmr,
  formatOmrAmount,
  joinQuantityIssue,
  minimumPriceIssue,
  omrPriceError,
  poolTermsErrors,
  toBaisa,
  wholeQuantityError,
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

describe("formatOmrAmount", () => {
  it.each([
    [1000, "1,000.000 OMR"],
    [0.1, "0.100 OMR"],
    [12.345, "12.345 OMR"],
  ])("shows %s as %s", (omr, text) => {
    expect(formatOmrAmount(omr)).toBe(text);
  });

  it("shows a dash for a missing amount", () => {
    expect(formatOmrAmount(undefined)).toBe("—");
  });
});

describe("approxUnitPriceBaisa", () => {
  it("is 10.000 OMR per unit for 100 units costing 1000 OMR", () => {
    expect(approxUnitPriceBaisa(offer)).toBe(10000);
  });

  it("rounds to the nearest baisa", () => {
    // 10 OMR / 3 = 3.3333… OMR
    expect(approxUnitPriceBaisa({ wholeQuantity: 3, totalWholesalePrice: 10 })).toBe(3333);
  });
});

describe("wholeQuantityError", () => {
  it.each(["1", "40", "100000"])("accepts %s", (input) => {
    expect(wholeQuantityError(input)).toBeNull();
  });

  it.each(["", "0", "-3", "12.5"])("refuses %j", (input) => {
    expect(wholeQuantityError(input)).toBe("Enter a whole number greater than 0.");
  });
});

describe("checkApproveTerms", () => {
  it("guides the admin before anything is entered", () => {
    expect(checkApproveTerms(offer, "", "")).toEqual({
      minimumContribution: { hint: "How many units each join takes: one lot." },
      minimumContributionPrice: {
        hint: "The price of one lot. Enter the minimum contribution to see the lowest allowed price.",
      },
    });
  });

  // R2/R4: the break-even is a placeholder and a label, never a value.
  it("shows the break-even once the minimum is valid, as placeholder and hint only", () => {
    const check = checkApproveTerms(offer, "25", "");

    expect(check.minimumContribution).toEqual({ hint: "4 lots of 25." });
    expect(check.pricePlaceholder).toBe("250.000");
    expect(check.minimumContributionPrice).toEqual({
      hint: "Minimum allowed price: 250.000 OMR (the supplier's cost of 25 units).",
    });
    expect(check.terms).toBeUndefined();
  });

  it("says who takes the leftover when the minimum doesn't divide the offer", () => {
    expect(checkApproveTerms(offer, "30", "").minimumContribution).toEqual({
      hint: "100 isn't a multiple of 30: the last joiner takes 30 + 10 units.",
    });
  });

  it.each([
    ["2.5", "Enter a whole number greater than 0."],
    ["0", "Enter a whole number greater than 0."],
    ["101", "Can't be more than the offer's quantity (100)."],
  ])("refuses a minimum of %s", (input, error) => {
    expect(checkApproveTerms(offer, input, "300").minimumContribution).toEqual({ error });
  });

  it.each([200, 249.999])("refuses %s OMR per 25 units as below cost", (price) => {
    const check = checkApproveTerms(offer, "25", String(price));

    expect(check.minimumContributionPrice).toEqual({
      error: "Below 250.000 OMR would put the business below cost for 25 units.",
    });
    expect(check.terms).toBeUndefined();
  });

  it("refuses a lot under the payment provider's minimum", () => {
    expect(checkApproveTerms(offer, "1", "0.099").minimumContributionPrice).toEqual({
      error: "Must be at least 0.100 OMR (the payment provider's minimum).",
    });
  });

  it("refuses a price finer than 1 baisa", () => {
    expect(checkApproveTerms(offer, "25", "300.0005").minimumContributionPrice.error).toContain(
      "at most 3 decimal places",
    );
  });

  it("shows the margin and hands over the terms once both are valid", () => {
    const check = checkApproveTerms(offer, "25", "300");

    expect(check.minimumContributionPrice).toEqual({
      hint: "+50.000 OMR over cost per 25 units (+200.000 OMR on the whole offer).",
    });
    expect(check.terms).toEqual({ minimumContribution: 25, minimumContributionPrice: 300 });
  });

  it("counts the leftover in the whole-offer margin", () => {
    // Lots of 30 at 330: 3 lots + 10 leftover at 110 = 1100 - 1000.
    expect(checkApproveTerms(offer, "30", "330").minimumContributionPrice.hint).toBe(
      "+30.000 OMR over cost per 30 units (+100.000 OMR on the whole offer).",
    );
  });

  it("accepts a price exactly at cost, saying there's no margin", () => {
    expect(checkApproveTerms(offer, "25", "250")).toMatchObject({
      minimumContributionPrice: { hint: "At cost: no margin." },
      terms: { minimumContribution: 25, minimumContributionPrice: 250 },
    });
  });

  it("can't judge a price against cost until the minimum is valid", () => {
    expect(checkApproveTerms(offer, "", "300")).toMatchObject({
      minimumContributionPrice: {
        hint: "Enter a valid minimum contribution to check this price against the supplier's cost.",
      },
    });
    expect(checkApproveTerms(offer, "", "300").terms).toBeUndefined();
  });
});
