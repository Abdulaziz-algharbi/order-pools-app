import { useEffect, useState } from "react";
import type { Pool } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { FieldWrapper, Input } from "@/components/ui/Field";
import { formatNumber } from "@/lib/utils";
import { contributionBaisa, formatOmrAmount } from "@/lib/pool-pricing";

type LotPool = Pick<Pool, "minimumContribution" | "minimumContributionPrice" | "currentQuantity" | "unit">;

interface LotPickerProps {
  pool: LotPool;
  /** The chosen quantity in units, or null while the typed number of lots isn't valid. */
  onChange: (quantity: number | null) => void;
}

/**
 * How much of a pool a retailer joins, chosen in lots so an amount the
 * backend would refuse can't be picked (order-pools-backend/docs/pricing-model-plan.md, R6):
 * - a number of lots, from 1 up to the most that still leave a lot for
 *   others — or every lot, when nothing is left over;
 * - when the pool doesn't divide into lots, "take everything still free",
 *   the only way to take the leftover;
 * - when only the last lot and the leftover are free, just that.
 * The total follows the choice, worked out as the backend charges it.
 * Exactly the sizes allowedJoinQuantities() lists.
 */
export function LotPicker({ pool, onChange }: LotPickerProps) {
  const lot = pool.minimumContribution;
  const free = pool.currentQuantity;
  const unit = pool.unit.toLowerCase();
  const leftover = free % lot;
  // With nothing left over, the last lot takes everything, so the stepper
  // reaches it; otherwise it stops one lot short and "everything" is its
  // own choice.
  const maxLots = leftover === 0 ? free / lot : Math.floor(free / lot) - 1;
  const canPickLots = maxLots >= 1;
  const canTakeAll = leftover !== 0;

  const [mode, setMode] = useState<"lots" | "all">(canPickLots ? "lots" : "all");
  const [lotsText, setLotsText] = useState("1");

  const lots = Number(lotsText);
  const lotsValid = Number.isInteger(lots) && lots >= 1 && lots <= maxLots;
  const quantity = mode === "all" ? free : lotsValid ? lots * lot : null;

  useEffect(() => {
    onChange(quantity);
  }, [quantity, onChange]);

  // − / + always land in range: from a typed number that isn't (e.g. 99),
  // they snap back to the nearest allowed one first.
  const setLots = (next: number) =>
    setLotsText(String(Math.min(maxLots, Math.max(1, Number.isFinite(next) ? Math.round(next) : 1))));
  const step = (by: number) => setLots(lotsValid ? lots + by : lots);

  const allLabel = (() => {
    const wholeLots = Math.floor(free / lot);
    const split =
      wholeLots === 0
        ? ""
        : ` (${formatNumber(wholeLots)} ${wholeLots === 1 ? "lot" : "lots"} + ${formatNumber(leftover)} left over)`;
    return `${formatNumber(free)} ${unit}${split}`;
  })();

  const stepper = (
    <FieldWrapper
      label={`Number of lots (${formatNumber(lot)} ${unit} each)`}
      htmlFor="join-lots"
      error={
        mode === "lots" && !lotsValid ? `Choose ${maxLots === 1 ? "1 lot" : `1 to ${formatNumber(maxLots)} lots`}.` : undefined
      }
      hint={`${formatOmrAmount(pool.minimumContributionPrice)} per lot · up to ${formatNumber(maxLots)} ${maxLots === 1 ? "lot" : "lots"}`}
    >
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          aria-label="Fewer lots"
          disabled={mode !== "lots" || (lotsValid && lots <= 1)}
          onClick={() => step(-1)}
        >
          −
        </Button>
        {/* Input is always full width, so the box sets its width. */}
        <div className="w-24">
          <Input
            id="join-lots"
            type="number"
            inputMode="numeric"
            min={1}
            max={maxLots}
            step={1}
            className="text-center"
            value={lotsText}
            disabled={mode !== "lots"}
            onChange={(e) => setLotsText(e.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          aria-label="More lots"
          disabled={mode !== "lots" || (lotsValid && lots >= maxLots)}
          onClick={() => step(1)}
        >
          +
        </Button>
      </div>
    </FieldWrapper>
  );

  return (
    <div className="space-y-3">
      {canPickLots && canTakeAll ? (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-primary">How much would you like to join?</legend>
          <label className="flex items-center gap-2 text-sm text-primary">
            <input type="radio" name="join-mode" checked={mode === "lots"} onChange={() => setMode("lots")} />
            Choose a number of lots
          </label>
          <div className="pl-6">{stepper}</div>
          <label className="flex items-center gap-2 text-sm text-primary">
            <input type="radio" name="join-mode" checked={mode === "all"} onChange={() => setMode("all")} />
            Take everything still free: {allLabel}
          </label>
        </fieldset>
      ) : canPickLots ? (
        stepper
      ) : (
        <p className="text-sm text-slate-600">
          Only everything still free can be joined now: <span className="font-medium text-primary">{allLabel}</span>.
        </p>
      )}

      <p aria-live="polite" className="text-sm text-slate-500">
        {quantity !== null && (
          <>
            Total:{" "}
            <span className="font-medium text-primary">
              {formatNumber(quantity)} {unit} · {formatOmrAmount(contributionBaisa(pool, quantity) / 1000)}
            </span>
          </>
        )}
      </p>
    </div>
  );
}
