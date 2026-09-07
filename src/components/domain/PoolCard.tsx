import type { ReactNode } from "react";
import type { Pool } from "@/types/domain";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatCurrency, formatDate, formatNumber, poolProgress, daysUntil } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface PoolCardProps {
  pool: Pool;
  action?: ReactNode;
  className?: string;
}

export function PoolCard({ pool, action, className }: PoolCardProps) {
  const collected = pool.targetQuantity - pool.currentQuantity;
  const progress = poolProgress(collected, pool.targetQuantity);
  const daysLeft = daysUntil(pool.endDate);
  const isOpen = pool.status === "OPEN";

  return (
    <Card className={cn("flex flex-col overflow-hidden", className)}>
      <div className="flex items-start justify-between gap-3 p-5 pb-0">
        <div className="min-w-0">
          {pool.supplierName && (
            <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-400">
              {pool.supplierName}
            </p>
          )}
          <h3 className="mt-0.5 truncate font-heading text-base font-semibold text-primary">
            {pool.productName}
          </h3>
        </div>
        <StatusBadge status={pool.status} domain="pool" className="shrink-0" />
      </div>

      <div className="space-y-4 p-5">
        <div className="flex items-baseline justify-between">
          <span className="font-heading text-xl font-semibold text-primary">
            {formatCurrency(pool.pricePerUnit)}
            <span className="text-sm font-normal text-slate-400"> / {pool.unit.toLowerCase()}</span>
          </span>
          {isOpen && (
            <span className={cn("text-xs font-medium", daysLeft <= 2 ? "text-red-600" : "text-slate-500")}>
              {daysLeft > 0 ? `${daysLeft}d left` : "Closing today"}
            </span>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="font-medium text-primary">
              {formatNumber(collected)} / {formatNumber(pool.targetQuantity)} {pool.unit.toLowerCase()}
            </span>
            <span className="text-slate-500">{progress}%</span>
          </div>
          <ProgressBar value={progress} />
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-400">Remaining</dt>
            <dd className="font-medium text-primary">
              {formatNumber(pool.currentQuantity)} {pool.unit.toLowerCase()}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">Min. contribution</dt>
            <dd className="font-medium text-primary">
              {formatNumber(pool.minimumContribution)} {pool.unit.toLowerCase()}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">Deadline</dt>
            <dd className="font-medium text-primary">{formatDate(pool.endDate)}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Participants</dt>
            <dd className="font-medium text-primary">{pool.participantCount}</dd>
          </div>
        </dl>
      </div>

      {action && <div className="mt-auto border-t border-slate-100 p-5">{action}</div>}
    </Card>
  );
}
