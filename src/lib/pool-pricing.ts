import { formatNumber } from "@/lib/utils";

// Pool pricing, mirroring the backend's src/services/pools/pool.pricing.ts
// exactly — same arithmetic, same messages — so what the form warns about
// is what the API would refuse (order-pools-backend/docs/pricing-model-plan.md).
//
// The supplier sells the whole offer (wholeQuantity units for
// totalWholesalePrice OMR); the admin sells it on to retailers in lots of
// minimumContribution units, each costing minimumContributionPrice OMR.
// minimumContribution needn't divide the pool's quantity: the leftover goes
// to whoever takes the last lot.
//
// Money is OMR with at most 3 decimals, but it's only compared or
// multiplied as integer baisa (toBaisa) and turned back into OMR once, for
// display (formatOmr), so float noise can't tip a check or a total.
// Quantities are whole numbers. Each *Issue function returns the problem,
// or null if it's fine.

// Thawani refuses a checkout under 100 baisa (0.100 OMR).
export const THAWANI_MIN_ORDER_BAISA = 100;

export interface OfferTerms {
  wholeQuantity: number;
  totalWholesalePrice: number;
}

export interface PoolTerms {
  minimumContribution: number;
  minimumContributionPrice: number;
}

export interface PoolAvailability {
  minimumContribution: number;
  /** What's still free to join (Pool.currentQuantity). */
  currentQuantity: number;
}

/** OMR (at most 3 decimals) as integer baisa: 12.345 -> 12345. */
export function toBaisa(omr: number): number {
  return Math.round(omr * 1000);
}

/** Baisa as OMR with its 3 decimals: 250000 -> "250.000". */
export function formatOmr(baisa: number): string {
  return (baisa / 1000).toFixed(3);
}

/**
 * The lowest minimumContributionPrice that still covers the supplier's cost
 * of minimumContribution units, rounded up to the baisa. A guide (the
 * admin's placeholder) and the below-cost threshold; never sent.
 */
export function breakEvenMinimumPriceBaisa(offer: OfferTerms, minimumContribution: number): number {
  return Math.ceil((toBaisa(offer.totalWholesalePrice) * minimumContribution) / offer.wholeQuantity);
}

/**
 * Selling every lot at minimumContributionPrice must bring in at least the
 * supplier's price. Cross-multiplied, so the check itself is exact.
 */
export function belowCostIssue(
  offer: OfferTerms,
  minimumContribution: number,
  minimumContributionPrice: number,
): string | null {
  const priceBaisa = toBaisa(minimumContributionPrice);
  if (priceBaisa * offer.wholeQuantity >= toBaisa(offer.totalWholesalePrice) * minimumContribution) {
    return null;
  }
  const breakEven = breakEvenMinimumPriceBaisa(offer, minimumContribution);
  return `minimumContributionPrice (${formatOmr(priceBaisa)} OMR) cannot be below the supplier-cost break-even of ${formatOmr(breakEven)} OMR for ${minimumContribution} units`;
}

/**
 * The checks pool terms need against the offer, keyed by field like the
 * API's 400 (approving an offer, POST /pools), or null.
 */
export function poolTermsErrors(
  offer: OfferTerms,
  minimumContribution: number,
  minimumContributionPrice: number,
): Record<string, string[]> | null {
  if (minimumContribution > offer.wholeQuantity) {
    return {
      minimumContribution: [`minimumContribution cannot exceed the offer's quantity (${offer.wholeQuantity})`],
    };
  }
  const belowCost = belowCostIssue(offer, minimumContribution, minimumContributionPrice);
  return belowCost ? { minimumContributionPrice: [belowCost] } : null;
}

/** Every join costs at least one lot, so a lot must reach Thawani's minimum. */
export function minimumPriceIssue(minimumContributionPrice: number): string | null {
  const priceBaisa = toBaisa(minimumContributionPrice);
  if (priceBaisa >= THAWANI_MIN_ORDER_BAISA) return null;
  return `minimumContributionPrice (${formatOmr(priceBaisa)} OMR) must be at least ${formatOmr(THAWANI_MIN_ORDER_BAISA)} OMR (the payment provider's minimum)`;
}

/**
 * A join takes whole lots while leaving at least one lot for others, or
 * everything still free — so the leftover can never be stranded.
 */
export function joinQuantityIssue(pool: PoolAvailability, quantity: number): string | null {
  const { minimumContribution: lot, currentQuantity: free } = pool;
  if (quantity === free) return null;
  if (quantity > free) {
    return `quantity (${quantity}) cannot exceed what is still free in the pool (${free})`;
  }
  const leaves = free - quantity;
  if (quantity % lot === 0 && leaves >= lot) return null;

  const cause =
    quantity % lot !== 0
      ? `quantity (${quantity}) is not a multiple of the minimum contribution (${lot})`
      : `quantity (${quantity}) would leave ${leaves}, less than the minimum contribution (${lot}), which nobody could join`;
  const largestLots = Math.floor(free / lot) - 1;
  const options =
    largestLots > 1
      ? `take a multiple of ${lot} up to ${largestLots * lot}, or all ${free} still free`
      : largestLots === 1
        ? `take ${lot}, or all ${free} still free`
        : `take all ${free} still free`;
  return `${cause} — ${options}`;
}

/**
 * Every quantity joinQuantityIssue accepts, smallest first: whole lots that
 * leave at least one lot, then everything still free. What the retailer's
 * join picker offers. Empty once nothing is free.
 */
export function allowedJoinQuantities(pool: PoolAvailability): number[] {
  const { minimumContribution: lot, currentQuantity: free } = pool;
  if (free <= 0) return [];
  if (!(lot >= 1)) return [free];
  const sizes: number[] = [];
  for (let quantity = lot; free - quantity >= lot; quantity += lot) sizes.push(quantity);
  sizes.push(free);
  return sizes;
}

/**
 * What a join of `quantity` units costs, in baisa: whole lots at the lot
 * price, plus the leftover (only in a take-all join) at its share of a lot,
 * rounded up. The backend charges exactly this.
 */
export function contributionBaisa(pool: PoolTerms, quantity: number): number {
  const lot = pool.minimumContribution;
  const lotBaisa = toBaisa(pool.minimumContributionPrice);
  const lots = Math.floor(quantity / lot);
  const extra = quantity % lot;
  return lots * lotBaisa + Math.ceil((extra * lotBaisa) / lot);
}

/**
 * Problem with an OMR amount typed into a form, or null. OMR has 3
 * decimals, so 1 baisa (0.001) is the smallest amount the payment provider
 * can charge — the backend's omrPrice rule. (Its message still says "per
 * unit" until F3 moves the offer form to the whole-offer price.)
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

// ---------------------------------------------------------------------------
// The old per-unit pricing, until the pages move over (F3, F4); removed in F9.
// ---------------------------------------------------------------------------

/** @deprecated The old per-unit pricing; CreateOfferPage stops using it in F3. */
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
 * @deprecated The old per-unit pricing (pricePerUnit × minimumContribution);
 * AdminOffersPage stops using it in F4.
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
