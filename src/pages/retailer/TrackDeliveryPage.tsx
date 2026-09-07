import { useFetch } from "@/hooks/useFetch";
import { listDeliveries, listMyParticipants, listPools } from "@/mocks/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Spinner";
import { TruckIcon, CheckIcon } from "@/components/ui/icons";
import { formatDateTime, formatNumber } from "@/lib/utils";
import type { Pool } from "@/types/domain";
import { cn } from "@/lib/utils";

const DELIVERY_STAGES: { key: Pool["status"]; label: string }[] = [
  { key: "TARGET_REACHED", label: "Target reached" },
  { key: "DISTRIBUTING", label: "Distributing" },
  { key: "COMPLETED", label: "Delivered" },
];

function stageIndex(status: Pool["status"]): number {
  if (status === "TARGET_REACHED") return 0;
  if (status === "DISTRIBUTING") return 1;
  if (status === "COMPLETED") return 2;
  return -1;
}

export function TrackDeliveryPage() {
  const { data: participants, isLoading: participantsLoading } = useFetch(() => listMyParticipants(), []);
  const { data: pools, isLoading: poolsLoading, error, refetch } = useFetch(() => listPools(), []);
  const { data: deliveries } = useFetch(() => listDeliveries(), []);

  const isLoading = participantsLoading || poolsLoading;
  const trackablePools = (pools ?? []).filter(
    (p) =>
      ["TARGET_REACHED", "DISTRIBUTING", "COMPLETED", "CANCELLED"].includes(p.status) &&
      (participants ?? []).some((part) => part.pool_ref === p._id),
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
            const myParticipation = participants?.find((p) => p.pool_ref === pool._id);
            const delivery = deliveries?.find((d) => d.pool_ref === pool._id);
            return (
              <Card key={pool._id}>
                <CardContent className="space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      {pool.supplierName && (
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          {pool.supplierName}
                        </p>
                      )}
                      <h3 className="font-heading text-base font-semibold text-primary">{pool.productName}</h3>
                      {myParticipation && (
                        <p className="mt-0.5 text-sm text-slate-500">
                          Your contribution: {formatNumber(myParticipation.quantity)} {pool.unit.toLowerCase()}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={pool.status} domain="pool" />
                  </div>

                  {pool.status === "CANCELLED" ? (
                    <p className="text-sm text-slate-500">
                      This pool was cancelled before reaching its target. Any payment made has been refunded or is
                      being processed.
                    </p>
                  ) : (
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
                              {i < idx || (i === idx && pool.status === "COMPLETED") ? (
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
                  )}

                  {delivery && (
                    <div className="rounded-lg bg-slate-50 p-4 text-sm">
                      <p className="text-slate-600">
                        Delivery status: <span className="font-medium text-primary">{delivery.deliveryStatus}</span>
                      </p>
                      {delivery.deliveryStatus === "DELIVERED" &&
                        delivery.deliveredAt &&
                        delivery.deliveredAt !== "Not Set" && (
                          <p className="mt-1 text-slate-600">
                            Delivered on{" "}
                            <span className="font-medium text-primary">{formatDateTime(delivery.deliveredAt)}</span>
                          </p>
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
