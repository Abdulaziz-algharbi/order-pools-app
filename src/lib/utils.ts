import { clsx, type ClassValue } from "clsx";
import type { Payment, Pool, PoolParticipant } from "@/types/domain";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

// Guards against a missing/non-numeric value rendering as the literal
// string "NaN" — can happen with a record from before a now-required
// field existed on the backend schema (e.g. a legacy Pool missing
// targetQuantity). Every call site gets this for free rather than each
// one needing its own fallback.
export function formatCurrency(value: number | undefined | null): string {
  return Number.isFinite(value) ? currencyFormatter.format(value as number) : "—";
}

const numberFormatter = new Intl.NumberFormat("en-US");

export function formatNumber(value: number | undefined | null): string {
  return Number.isFinite(value) ? numberFormatter.format(value as number) : "—";
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatRelativeTime(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(value);
}

export function daysUntil(value: string): number {
  const diffMs = new Date(value).getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

// How a pool's target splits up. `paid` is what progress shows, so an
// unfinished checkout never looks like a contribution; `awaitingPayment`
// is reserved by a join but not yet paid (released by the backend if the
// checkout is never finished). A legacy pool without paidQuantity falls
// back to counting every reservation as collected, as before.
export function poolQuantities(pool: Pick<Pool, "targetQuantity" | "currentQuantity" | "paidQuantity">) {
  const reserved = pool.targetQuantity - pool.currentQuantity;
  const paid = pool.paidQuantity ?? reserved;
  return { paid, awaitingPayment: Math.max(0, reserved - paid) };
}

export function poolProgress(current: number, target: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Mirrors PoolParticipantController.delete()'s own guard exactly (see
// pool.participants.controller.ts): a participant may withdraw while the
// pool is still OPEN (backing out before it commits), once it's COMPLETED
// (fully delivered), or 7+ days after it was CANCELLED (a grace period for
// refund/dispute handling). Any other pool status blocks it.
export function canWithdrawFromPool(pool: { status: string; updatedAt: string }): boolean {
  if (pool.status === "OPEN" || pool.status === "COMPLETED") return true;
  if (pool.status !== "CANCELLED") return false;
  return Date.now() - new Date(pool.updatedAt).getTime() >= SEVEN_DAYS_MS;
}

// Still holding quantity in the pool — on an OPEN pool only these can
// leave. Anything else (withdrawn, failed) already has, and the backend
// would delete the record itself instead of withdrawing it.
const ACTIVE_JOIN_STATUSES: PoolParticipant["status"][] = ["PENDING_PAYMENT", "WAITING"];

export function canLeaveJoin(
  participant: Pick<PoolParticipant, "status">,
  pool: { status: string; updatedAt: string },
): boolean {
  if (pool.status === "OPEN") return ACTIVE_JOIN_STATUSES.includes(participant.status);
  return canWithdrawFromPool(pool);
}

const REFUND_STATUSES: Payment["status"][] = ["REFUND_PENDING", "REFUNDED", "REFUND_FAILED"];

// The status a retailer's join is shown with. The participant's own status
// says what happened to the join (e.g. WITHDRAWN, kept as history), but the
// refund's progress lives on its Payment — so once a refund is under way
// the badge follows the payment, keeping "Withdrawn" in front when that's
// why. Keys are StatusBadge's "participant:" labels.
export function joinBadgeStatus(
  participant: Pick<PoolParticipant, "status">,
  payment?: Pick<Payment, "status">,
): string {
  if (!payment || !REFUND_STATUSES.includes(payment.status)) return participant.status;
  return participant.status === "WITHDRAWN" ? `WITHDRAWN_${payment.status}` : payment.status;
}

// Mirrors the backend's PAID_PARTICIPANT_STATUSES: a retailer who paid and
// is part of the pool's order (and its delivery).
const PAID_JOIN_STATUSES: PoolParticipant["status"][] = ["WAITING", "DELIVERED"];

// Whether a pool belongs on the retailer's delivery-tracking page: they
// paid into it — or it was cancelled while they were in it and they were
// refunded. A withdrawn or failed join isn't part of the order.
export function tracksPoolDelivery(
  participant: Pick<PoolParticipant, "status">,
  pool: Pick<Pool, "status">,
): boolean {
  if (PAID_JOIN_STATUSES.includes(participant.status)) return true;
  return pool.status === "CANCELLED" && participant.status === "REFUNDED";
}
