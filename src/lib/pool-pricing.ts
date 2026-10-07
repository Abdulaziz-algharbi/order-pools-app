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

const omrFormatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/**
 * An OMR amount for display, grouped and with its 3 decimals:
 * 1000 -> "1,000.000 OMR". "—" for a missing value.
 */
export function formatOmrAmount(omr: number | undefined | null): string {
  return Number.isFinite(omr) ? `${omrFormatter.format(toBaisa(omr as number) / 1000)} OMR` : "—";
}

/**
 * What `quantity` units of a pool come to, in OMR — what joins of that much
 * were charged. Joins add up exactly: every join but the take-all is whole
 * lots, so only that one can carry the leftover.
 */
export function poolAmount(pool: PoolTerms, quantity: number): number {
  return contributionBaisa(pool, quantity) / 1000;
}

/**
 * What one unit of an offer comes to, to the nearest baisa — only a
 * read-only guide for the supplier, who prices the whole offer.
 */
export function approxUnitPriceBaisa(offer: OfferTerms): number {
  return Math.round(toBaisa(offer.totalWholesalePrice) / offer.wholeQuantity);
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
 * can charge — the backend's omrPrice rule.
 */
export function omrPriceError(priceInput: string): string | null {
  const price = Number(priceInput);
  if (priceInput.trim() === "" || !(price > 0)) return "Enter a price greater than 0.";
  const baisa = Math.round(price * 1000);
  if (Math.abs(price * 1000 - baisa) > 1e-6 || baisa < 1) {
    return "Enter at least 0.001 OMR, with at most 3 decimal places (1 baisa = 0.001 OMR).";
  }
  return null;
}

/** What to show under one field: a problem, or a guide. */
export interface FieldGuidance {
  error?: string;
  hint?: string;
}

export interface ApproveTermsCheck {
  minimumContribution: FieldGuidance;
  minimumContributionPrice: FieldGuidance;
  /** The break-even price, once the minimum is valid — a placeholder only, never a value. */
  pricePlaceholder?: string;
  /** Both terms, once they pass every check: what the approve form sends. */
  terms?: PoolTerms;
}

/**
 * Live guidance for the admin's pool terms as they type, with the same
 * rules the backend applies on approve (poolTermsErrors, minimumPriceIssue)
 * in the admin's words. Nothing is filled in for them: the break-even is
 * only a placeholder (R2, R4).
 */
export function checkApproveTerms(offer: OfferTerms, minimumInput: string, priceInput: string): ApproveTermsCheck {
  const check: ApproveTermsCheck = { minimumContribution: {}, minimumContributionPrice: {} };

  let minimum: number | null = null;
  if (minimumInput.trim() === "") {
    check.minimumContribution.hint = "How many units each join takes: one lot.";
  } else if (wholeQuantityError(minimumInput)) {
    check.minimumContribution.error = wholeQuantityError(minimumInput)!;
  } else if (Number(minimumInput) > offer.wholeQuantity) {
    check.minimumContribution.error = `Can't be more than the offer's quantity (${formatNumber(offer.wholeQuantity)}).`;
  } else {
    minimum = Number(minimumInput);
    const lots = Math.floor(offer.wholeQuantity / minimum);
    const leftover = offer.wholeQuantity % minimum;
    check.minimumContribution.hint =
      leftover === 0
        ? `${formatNumber(lots)} lots of ${formatNumber(minimum)}.`
        : `${formatNumber(offer.wholeQuantity)} isn't a multiple of ${formatNumber(minimum)}: the last joiner takes ${formatNumber(minimum)} + ${formatNumber(leftover)} units.`;
  }

  const breakEven = minimum === null ? null : breakEvenMinimumPriceBaisa(offer, minimum);
  if (breakEven !== null) check.pricePlaceholder = formatOmr(breakEven);

  const price = check.minimumContributionPrice;
  if (priceInput.trim() === "") {
    price.hint =
      breakEven === null
        ? "The price of one lot. Enter the minimum contribution to see the lowest allowed price."
        : `Minimum allowed price: ${formatOmr(breakEven)} OMR (the supplier's cost of ${formatNumber(minimum!)} units).`;
  } else if (omrPriceError(priceInput)) {
    price.error = omrPriceError(priceInput)!;
  } else if (minimumPriceIssue(Number(priceInput))) {
    price.error = `Must be at least ${formatOmr(THAWANI_MIN_ORDER_BAISA)} OMR (the payment provider's minimum).`;
  } else if (breakEven !== null && belowCostIssue(offer, minimum!, Number(priceInput))) {
    price.error = `Below ${formatOmr(breakEven)} OMR would put the business below cost for ${formatNumber(minimum!)} units.`;
  } else if (breakEven !== null) {
    const priceBaisa = toBaisa(Number(priceInput));
    const perLot = priceBaisa - breakEven;
    const wholeOffer =
      contributionBaisa({ minimumContribution: minimum!, minimumContributionPrice: Number(priceInput) }, offer.wholeQuantity) -
      toBaisa(offer.totalWholesalePrice);
    price.hint =
      perLot === 0
        ? "At cost: no margin."
        : `+${formatOmr(perLot)} OMR over cost per ${formatNumber(minimum!)} units (+${formatOmr(wholeOffer)} OMR on the whole offer).`;
    check.terms = { minimumContribution: minimum!, minimumContributionPrice: Number(priceInput) };
  } else {
    price.hint = "Enter a valid minimum contribution to check this price against the supplier's cost.";
  }

  return check;
}

/** Problem with a quantity typed into a form, or null: quantities are whole numbers (the backend's unitQuantity). */
export function wholeQuantityError(quantityInput: string): string | null {
  const quantity = Number(quantityInput);
  if (quantityInput.trim() === "" || !Number.isInteger(quantity) || quantity <= 0) {
    return "Enter a whole number greater than 0.";
  }
  return null;
}
