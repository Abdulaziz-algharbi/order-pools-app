import { useFetch } from "@/hooks/useFetch";
import { listPools } from "@/mocks/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Spinner";
import { MapPinIcon } from "@/components/ui/icons";
import { formatDateTime } from "@/lib/utils";

export function AdminTrackPoolsPage() {
  const { data: pools, isLoading, error, refetch } = useFetch(
    () => listPools({ status: ["delivery_assigned", "delivered"] }),
    [],
  );

  return (
    <div>
      <PageHeader title="Track Pools" description="Met pools currently in delivery, with their assigned driver." />

      {error ? (
        <ErrorState onRetry={refetch} />
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : (pools ?? []).length === 0 ? (
        <EmptyState
          icon={<MapPinIcon className="h-8 w-8" />}
          title="No deliveries in progress"
          description="Assign a driver from Met Pools to start tracking a delivery here."
        />
      ) : (
        <div className="space-y-3">
          {pools!.map((pool) => (
            <Card key={pool.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{pool.supplierName}</p>
                  <h3 className="font-heading text-base font-semibold text-primary">{pool.productName}</h3>
                  {pool.delivery?.driverName && (
                    <p className="mt-1 text-sm text-slate-500">
                      Driver: <span className="font-medium text-primary">{pool.delivery.driverName}</span>
                      {pool.delivery.driverPhone && ` · ${pool.delivery.driverPhone}`}
                    </p>
                  )}
                  {pool.delivery?.estimatedArrival && pool.status !== "delivered" && (
                    <p className="text-sm text-slate-500">
                      ETA: {formatDateTime(pool.delivery.estimatedArrival)}
                    </p>
                  )}
                  {pool.delivery?.deliveredAt && (
                    <p className="text-sm text-slate-500">Delivered {formatDateTime(pool.delivery.deliveredAt)}</p>
                  )}
                </div>
                <StatusBadge status={pool.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
