import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFetch } from "@/hooks/useFetch";
import { createDelivery, listPools } from "@/mocks/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Spinner";
import { LayersIcon } from "@/components/ui/icons";
import { formatDate, formatNumber } from "@/lib/utils";
import { ApiError } from "@/lib/http";
import type { Pool } from "@/types/domain";

export function AdminMetPoolsPage() {
  const navigate = useNavigate();
  const { data: pools, isLoading, error, refetch } = useFetch(() => listPools({ status: "TARGET_REACHED" }), []);

  const [activePool, setActivePool] = useState<Pool | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleStartDelivery = async () => {
    if (!activePool) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await createDelivery(activePool._id);
      setActivePool(null);
      refetch();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Could not start delivery.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader title="Met Pools" description="Pools that reached their target quantity and are ready to start delivery." />

      {error ? (
        <ErrorState onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : (pools ?? []).length === 0 ? (
        <EmptyState icon={<LayersIcon className="h-8 w-8" />} title="No pools awaiting delivery" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pools!.map((pool) => (
            <Card key={pool._id}>
              <CardContent className="space-y-3">
                <div>
                  {pool.supplierName && (
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{pool.supplierName}</p>
                  )}
                  <h3 className="font-heading text-base font-semibold text-primary">{pool.productName}</h3>
                </div>
                <p className="text-sm text-slate-500">
                  {formatNumber(pool.targetQuantity)} {pool.unit.toLowerCase()} across {pool.participantCount} retailers
                </p>
                <p className="text-sm text-slate-500">Deadline was {formatDate(pool.endDate)}</p>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => navigate(`/admin/pools/${pool._id}`)}>
                    View details
                  </Button>
                  <Button size="sm" onClick={() => setActivePool(pool)}>
                    Start delivery
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!activePool}
        onClose={() => setActivePool(null)}
        title="Start delivery"
        description={activePool ? `Begin distributing ${activePool.productName} to participating retailers.` : ""}
        footer={
          <>
            <Button variant="outline" onClick={() => setActivePool(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleStartDelivery} isLoading={submitting}>
              Start delivery
            </Button>
          </>
        }
      >
        {formError && <p className="text-sm text-red-600">{formError}</p>}
      </Modal>
    </div>
  );
}
