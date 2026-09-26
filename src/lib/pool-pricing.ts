import { formatNumber } from "@/lib/utils";

// Thawani refuses a checkout under 100 baisa (0.100 OMR). Every join takes
// at least minimumContribution units, so a pool whose minimum costs at
// least this can never send a retailer to a checkout Thawani rejects.
// Mirrors the backend's pool.schema.ts (minimumContributionIssue).
export const THAWANI_MIN_ORDER_BAISA = 100;

/**
 * Problem with an OMR unit price, or null. OMR has 3 decimals, so 1 baisa
 * (0.001) is the smallest amount the payment provider can charge per unit
 * — the backend's omrPrice rule, used for both offer and pool prices.
 */
export function omrPriceError(priceInput: string): string | null {
  const price = Number(priceInput);
  if (priceInput.trim() === "" || !(price > 0)) return "Enter a price greater than 0.";
  const baisa = Math.round(price * 1000);
  if (Math.abs(price * 1000 - baisa) > 1e-6 || baisa < 1) {
    return "Price per unit must be at least 0.001 OMR, with at most 3 decimal places (1 baisa = 0.001 OMR).";
  }
  return null;
}

/** Shown to a supplier setting an offer's unit price. */
export const OFFER_PRICE_HINT =
  "Retailers pay at least 0.100 OMR per order (the payment provider's minimum), so a low unit price means each retailer has to buy a larger minimum quantity.";

export interface PoolPricingCheck {
  /** Field the problem belongs to, if any. */
  field?: "pricePerUnit" | "minimumContribution";
  /** A problem that blocks creating the pool. */
  error?: string;
  /** Guidance to show when nothing is wrong (or not yet filled in). */
  hint?: string;
}

/**
 * Live check of the pool's price terms as the admin types — the same rule
 * the backend enforces, shown before submitting rather than after.
 */
export function checkPoolPricing(pricePerUnitInput: string, minimumContributionInput: string): PoolPricingCheck {
  const price = Number(pricePerUnitInput);
  if (pricePerUnitInput.trim() === "" || !(price > 0)) {
    return {
      hint: "The payment provider only accepts payments of 0.100 OMR or more, so the minimum contribution has to cost at least that.",
    };
  }

  const priceError = omrPriceError(pricePerUnitInput);
  if (priceError) return { field: "pricePerUnit", error: priceError };
  const unitBaisa = Math.round(price * 1000);

  const required = Math.ceil(THAWANI_MIN_ORDER_BAISA / unitBaisa);
  const minimum = Number(minimumContributionInput);
  if (minimumContributionInput.trim() === "" || !(minimum > 0)) {
    return {
      hint: `At ${price} OMR per unit, set at least ${formatNumber(required)} so each join reaches the payment provider's 0.100 OMR minimum.`,
    };
  }

  const perJoin = ((unitBaisa * minimum) / 1000).toFixed(3);
  if (unitBaisa * minimum < THAWANI_MIN_ORDER_BAISA) {
    return {
      field: "minimumContribution",
      error: `A minimum join would cost ${perJoin} OMR, but the payment provider requires at least 0.100 OMR. Set at least ${formatNumber(required)}.`,
    };
  }

  return { hint: `Each join costs at least ${perJoin} OMR.` };
}
