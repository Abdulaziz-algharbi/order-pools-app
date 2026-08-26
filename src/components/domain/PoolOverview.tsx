import type { ReactNode } from "react";
import type { Pool, PoolParticipant } from "@/types/domain";
import { Card, CardContent } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { daysUntil, formatCurrency, formatDate, formatNumber, poolProgress } from "@/lib/utils";

interface PoolOverviewProps {
  pool: Pool;
  participants?: PoolParticipant[];
  children?: ReactNode;
}

export function PoolOverview({ pool, participants, children }: PoolOverviewProps) {
  const progress = poolProgress(pool.currentQuantity, pool.targetQuantity);
  const remaining = Math.max(0, pool.targetQuantity - pool.currentQuantity);
  const daysLeft = daysUntil(pool.deadline);

  return (
    <Card>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-400">
              {pool.category} &middot; Supplied by {pool.supplierName}
            </p>
            <h1 className="mt-1 font-heading text-2xl font-semibold text-primary">{pool.productName}</h1>
          </div>
          <StatusBadge status={pool.status} />
        </div>

        <p className="text-slate-600">{pool.productDescription}</p>

        <div className="grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-400">Price</p>
            <p className="font-heading text-lg font-semibold text-primary">
              {formatCurrency(pool.unitPrice)}
              <span className="text-sm font-normal text-slate-400">/{pool.unit.replace(/s$/, "")}</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Minimum contribution</p>
            <p className="font-heading text-lg font-semibold text-primary">
              {formatNumber(pool.minContribution)} {pool.unit}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Deadline</p>
            <p className="font-heading text-lg font-semibold text-primary">{formatDate(pool.deadline)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Participants</p>
            <p className="font-heading text-lg font-semibold text-primary">{pool.participantCount}</p>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-primary">
              {formatNumber(pool.currentQuantity)} of {formatNumber(pool.targetQuantity)} {pool.unit} collected
            </span>
            <span className="text-slate-500">{progress}%</span>
          </div>
          <ProgressBar value={progress} className="h-3" />
          <p className="mt-2 text-sm text-slate-500">
            {formatNumber(remaining)} {pool.unit} still needed
            {pool.status === "active" && (daysLeft > 0 ? ` · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : " · closing today")}
          </p>
        </div>

        {participants && participants.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-primary">Participating retailers</p>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {participants.map((p, i) => (
                <li key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-slate-600">{p.retailerName}</span>
                  <span className="font-medium text-primary">
                    {formatNumber(p.quantity)} {pool.unit}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {children}
      </CardContent>
    </Card>
  );
}
