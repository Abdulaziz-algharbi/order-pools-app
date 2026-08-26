import { cn } from "@/lib/utils";

type KnownStatus =
  // Pool
  | "active"
  | "met"
  | "delivery_assigned"
  | "delivered"
  | "closed"
  // Supplier offer
  | "pending_review"
  | "negotiation"
  | "accepted"
  | "refused"
  // Complaint
  | "open"
  | "in_review"
  | "resolved"
  | "dismissed"
  // Delivery
  | "preparing"
  | "assigned"
  | "in_transit"
  // Supplier request
  | "pending"
  | "approved"
  | "rejected";

const STYLES: Record<KnownStatus, string> = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  met: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  delivery_assigned: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  delivered: "bg-slate-100 text-slate-700 ring-slate-500/20",
  closed: "bg-slate-100 text-slate-500 ring-slate-500/20",

  pending_review: "bg-amber-50 text-amber-700 ring-amber-600/20",
  negotiation: "bg-tertiary/10 text-tertiary ring-tertiary/20",
  accepted: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  refused: "bg-red-50 text-red-700 ring-red-600/20",

  open: "bg-amber-50 text-amber-700 ring-amber-600/20",
  in_review: "bg-tertiary/10 text-tertiary ring-tertiary/20",
  resolved: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  dismissed: "bg-slate-100 text-slate-500 ring-slate-500/20",

  preparing: "bg-amber-50 text-amber-700 ring-amber-600/20",
  assigned: "bg-tertiary/10 text-tertiary ring-tertiary/20",
  in_transit: "bg-tertiary/10 text-tertiary ring-tertiary/20",

  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  rejected: "bg-red-50 text-red-700 ring-red-600/20",
};

const LABELS: Record<KnownStatus, string> = {
  active: "Active",
  met: "Met",
  delivery_assigned: "Delivery Assigned",
  delivered: "Delivered",
  closed: "Closed",

  pending_review: "Pending Review",
  negotiation: "Negotiation",
  accepted: "Accepted",
  refused: "Refused",

  open: "Open",
  in_review: "In Review",
  resolved: "Resolved",
  dismissed: "Dismissed",

  preparing: "Preparing",
  assigned: "Assigned",
  in_transit: "In Transit",

  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const known = status as KnownStatus;
  const style = STYLES[known] ?? "bg-slate-100 text-slate-700 ring-slate-500/20";
  const label = LABELS[known] ?? status;

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
