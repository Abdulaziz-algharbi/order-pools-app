import { useState } from "react";
import { useFetch } from "@/hooks/useFetch";
import { listDeliveries, listPools, updateDeliveryStatus } from "@/mocks/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Spinner";
import { MapPinIcon } from "@/components/ui/icons";

export function AdminTrackPoolsPage() {
  const { data: pools, isLoading, error, refetch } = useFetch(
    () => listPools({ status: ["DISTRIBUTING", "COMPLETED"] }),
    [],
  );
  const { data: deliveries, refetch: refetchDeliveries } = useFetch(() => listDeliveries(), []);
  const [advancingId, setAdvancingId] = useState<string | null>(null);

  const handleAdvance = async (deliveryId: string) => {
    setAdvancingId(deliveryId);
    try {
      await updateDeliveryStatus(deliveryId, "DELIVERED");
      refetchDeliveries();
      refetch();
    } finally {
      setAdvancingId(null);
    }
  };

  const handleStartTransit = async (deliveryId: string) => {
    setAdvancingId(deliveryId);
    try {
      await updateDeliveryStatus(deliveryId, "DELIVERING");
      refetchDeliveries();
    } finally {
      setAdvancingId(null);
    }
  };

  return (
    <div>
      <PageHeader title="Track Pools" description="Pools currently distributing or completed, with their delivery status." />

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
          description="Start a delivery from Met Pools to begin tracking it here."
        />
      ) : (
        <div className="space-y-3">
          {pools!.map((pool) => {
            const delivery = deliveries?.find((d) => d.pool_ref === pool._id);
            return (
              <Card key={pool._id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    {pool.supplierName && (
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{pool.supplierName}</p>
                    )}
                    <h3 className="font-heading text-base font-semibold text-primary">{pool.productName}</h3>
                    {delivery && (
                      <p className="mt-1 text-sm text-slate-500">
                        Delivery status: <span className="font-medium text-primary">{delivery.deliveryStatus}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={pool.status} domain="pool" />
                    {delivery?.deliveryStatus === "PENDING" && (
                      <Button size="sm" isLoading={advancingId === delivery._id} onClick={() => handleStartTransit(delivery._id)}>
                        Start transit
                      </Button>
                    )}
                    {delivery?.deliveryStatus === "DELIVERING" && (
                      <Button size="sm" isLoading={advancingId === delivery._id} onClick={() => handleAdvance(delivery._id)}>
                        Mark delivered
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
