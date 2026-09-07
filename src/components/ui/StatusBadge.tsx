import { cn } from "@/lib/utils";

// Backend status enums are UPPER_SNAKE and reused verbatim across domains
// (Pool, ProductOffer, Complaint, Delivery, PoolParticipant, SupplierRequest)
// — most of that overlap reads the same way everywhere (APPROVED is always
// good, REJECTED always bad, PENDING always amber), but "OPEN" means the
// opposite thing for a Pool (still collecting — good) as for a Complaint
// (not yet addressed — needs attention), so `domain` disambiguates only
// where a bare status string would otherwise collide.
export type StatusDomain = "pool" | "offer" | "complaint" | "delivery" | "participant" | "review";

const STYLES: Record<string, string> = {
  OPEN: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  TARGET_REACHED: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  DISTRIBUTING: "bg-tertiary/10 text-tertiary ring-tertiary/20",
  COMPLETED: "bg-slate-100 text-slate-700 ring-slate-500/20",
  CANCELLED: "bg-red-50 text-red-700 ring-red-600/20",

  PENDING: "bg-amber-50 text-amber-700 ring-amber-600/20",
  NEGOTIATION: "bg-tertiary/10 text-tertiary ring-tertiary/20",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  REJECTED: "bg-red-50 text-red-700 ring-red-600/20",

  "UNDER REVIEW": "bg-tertiary/10 text-tertiary ring-tertiary/20",
  RESOLVED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",

  DELIVERING: "bg-tertiary/10 text-tertiary ring-tertiary/20",
  DELIVERED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",

  PENDING_PAYMENT: "bg-amber-50 text-amber-700 ring-amber-600/20",
  WAITING: "bg-tertiary/10 text-tertiary ring-tertiary/20",
  PAYMENT_FAILED: "bg-red-50 text-red-700 ring-red-600/20",
  REFUNDED: "bg-slate-100 text-slate-700 ring-slate-500/20",

  "complaint:OPEN": "bg-amber-50 text-amber-700 ring-amber-600/20",
};

const LABELS: Record<string, string> = {
  OPEN: "Open",
  TARGET_REACHED: "Target Reached",
  DISTRIBUTING: "Distributing",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",

  PENDING: "Pending",
  NEGOTIATION: "Negotiation",
  APPROVED: "Approved",
  REJECTED: "Rejected",

  "UNDER REVIEW": "Under Review",
  RESOLVED: "Resolved",

  DELIVERING: "Delivering",
  DELIVERED: "Delivered",

  PENDING_PAYMENT: "Payment Pending",
  WAITING: "Waiting",
  PAYMENT_FAILED: "Payment Failed",
  REFUNDED: "Refunded",

  "complaint:OPEN": "Open",
};

const FALLBACK_STYLE = "bg-slate-100 text-slate-700 ring-slate-500/20";

interface StatusBadgeProps {
  status: string;
  domain?: StatusDomain;
  className?: string;
}

export function StatusBadge({ status, domain, className }: StatusBadgeProps) {
  const scopedKey = domain ? `${domain}:${status}` : status;
  const style = STYLES[scopedKey] ?? STYLES[status] ?? FALLBACK_STYLE;
  const label = LABELS[scopedKey] ?? LABELS[status] ?? status;

  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        style,
        className,
      )}
    >
      {label}
    </span>
  );
}
