import { useAuth } from "@/context/AuthContext";
import { useFetch } from "@/hooks/useFetch";
import { listJoinsByRetailer, listPools } from "@/mocks/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Spinner";
import { TruckIcon, CheckIcon } from "@/components/ui/icons";
import { formatDateTime, formatNumber } from "@/lib/utils";
import type { Pool, RetailerUser } from "@/types/domain";
import { cn } from "@/lib/utils";

const DELIVERY_STAGES: { key: Pool["status"]; label: string }[] = [
  { key: "met", label: "Target reached" },
  { key: "delivery_assigned", label: "Driver assigned" },
  { key: "delivered", label: "Delivered" },
];

function stageIndex(status: Pool["status"]): number {
  if (status === "met") return 0;
  if (status === "delivery_assigned") return 1;
  if (status === "delivered" || status === "closed") return 2;
  return -1;
}

export function TrackDeliveryPage() {
  const { user } = useAuth();
  const retailer = user as RetailerUser;

  const { data: joins, isLoading: joinsLoading } = useFetch(() => listJoinsByRetailer(retailer.id), [retailer.id]);
  const { data: pools, isLoading: poolsLoading, error, refetch } = useFetch(() => listPools(), []);

  const isLoading = joinsLoading || poolsLoading;
  const trackablePools = (pools ?? []).filter(
    (p) =>
      ["met", "delivery_assigned", "delivered", "closed"].includes(p.status) &&
      (joins ?? []).some((j) => j.poolId === p.id),
  );

  return (
    <div>
      <PageHeader title="Track Deliveries" description="Follow the delivery progress of pools you've joined." />

      {error ? (
        <ErrorState onRetry={refetch} />
      ) : isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : trackablePools.length === 0 ? (
        <EmptyState
          icon={<TruckIcon className="h-8 w-8" />}
          title="No deliveries to track yet"
          description="Once a pool you've joined reaches its target, delivery progress will appear here."
        />
      ) : (
        <div className="space-y-4">
          {trackablePools.map((pool) => {
            const idx = stageIndex(pool.status);
            const myJoin = joins?.find((j) => j.poolId === pool.id);
            return (
              <Card key={pool.id}>
                <CardContent className="space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        {pool.supplierName}
                      </p>
                      <h3 className="font-heading text-base font-semibold text-primary">{pool.productName}</h3>
                      {myJoin && (
                        <p className="mt-0.5 text-sm text-slate-500">
                          Your contribution: {formatNumber(myJoin.quantity)} {pool.unit}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={pool.status} />
                  </div>

                  <div className="flex items-center">
                    {DELIVERY_STAGES.map((stage, i) => (
                      <div key={stage.key} className="flex flex-1 items-center last:flex-none">
                        <div className="flex flex-col items-center gap-1.5">
                          <div
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold",
                              i <= idx
                                ? "border-secondary bg-secondary text-white"
                                : "border-slate-200 bg-white text-slate-400",
                            )}
                          >
                            {i < idx || (i === idx && pool.status === "delivered") ? (
                              <CheckIcon className="h-4 w-4" />
                            ) : (
                              i + 1
                            )}
                          </div>
                          <span
                            className={cn(
                              "w-20 text-center text-xs",
                              i <= idx ? "font-medium text-primary" : "text-slate-400",
                            )}
                          >
                            {stage.label}
                          </span>
                        </div>
                        {i < DELIVERY_STAGES.length - 1 && (
                          <div className={cn("mx-1 h-0.5 flex-1", i < idx ? "bg-secondary" : "bg-slate-200")} />
                        )}
                      </div>
                    ))}
                  </div>

                  {pool.delivery && (
                    <div className="rounded-lg bg-slate-50 p-4 text-sm">
                      {pool.delivery.driverName && (
                        <p className="text-slate-600">
                          Driver: <span className="font-medium text-primary">{pool.delivery.driverName}</span>
                          {pool.delivery.driverPhone && ` · ${pool.delivery.driverPhone}`}
                        </p>
                      )}
                      {pool.delivery.estimatedArrival && pool.delivery.status !== "delivered" && (
                        <p className="mt-1 text-slate-600">
                          Estimated arrival:{" "}
                          <span className="font-medium text-primary">{formatDateTime(pool.delivery.estimatedArrival)}</span>
                        </p>
                      )}
                      {pool.delivery.deliveredAt && (
                        <p className="mt-1 text-slate-600">
                          Delivered on{" "}
                          <span className="font-medium text-primary">{formatDateTime(pool.delivery.deliveredAt)}</span>
                        </p>
                      )}
                      {pool.delivery.updates.length > 0 && (
                        <ul className="mt-3 space-y-1.5 border-t border-slate-200 pt-3">
                          {pool.delivery.updates.map((u) => (
                            <li key={u.id} className="flex justify-between gap-3 text-xs text-slate-500">
                              <span>{u.message}</span>
                              <span className="shrink-0">{formatDateTime(u.timestamp)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
