import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFetch } from "@/hooks/useFetch";
import { assignDelivery, listPools } from "@/mocks/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FieldWrapper, Input } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Spinner";
import { LayersIcon } from "@/components/ui/icons";
import { formatDate, formatNumber } from "@/lib/utils";
import type { Pool } from "@/types/domain";

export function AdminMetPoolsPage() {
  const navigate = useNavigate();
  const { data: pools, isLoading, error, refetch } = useFetch(() => listPools({ status: "met" }), []);

  const [activePool, setActivePool] = useState<Pool | null>(null);
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [eta, setEta] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const openAssign = (pool: Pool) => {
    setActivePool(pool);
    setDriverName("");
    setDriverPhone("");
    setEta("");
    setFormError(null);
  };

  const handleAssign = async () => {
    if (!activePool) return;
    if (!driverName.trim() || !driverPhone.trim() || !eta) {
      setFormError("All fields are required.");
      return;
    }
    setSubmitting(true);
    try {
      await assignDelivery(activePool.id, driverName.trim(), driverPhone.trim(), new Date(eta).toISOString());
      setActivePool(null);
      refetch();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not assign delivery.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader title="Met Pools" description="Pools that reached their target quantity and are ready for delivery assignment." />

      {error ? (
        <ErrorState onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : (pools ?? []).length === 0 ? (
        <EmptyState icon={<LayersIcon className="h-8 w-8" />} title="No pools awaiting delivery assignment" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pools!.map((pool) => (
            <Card key={pool.id}>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{pool.supplierName}</p>
                  <h3 className="font-heading text-base font-semibold text-primary">{pool.productName}</h3>
                </div>
                <p className="text-sm text-slate-500">
                  {formatNumber(pool.targetQuantity)} {pool.unit} across {pool.participantCount} retailers
                </p>
                <p className="text-sm text-slate-500">Met on {formatDate(pool.deadline)}</p>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => navigate(`/admin/pools/${pool.id}`)}>
                    View details
                  </Button>
                  <Button size="sm" onClick={() => openAssign(pool)}>
                    Assign delivery
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
        title="Assign delivery"
        description={activePool ? `Assign a driver to fulfill ${activePool.productName}.` : ""}
        footer={
          <>
            <Button variant="outline" onClick={() => setActivePool(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleAssign} isLoading={submitting}>
              Assign
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FieldWrapper label="Driver name" htmlFor="driverName" required>
            <Input id="driverName" value={driverName} onChange={(e) => setDriverName(e.target.value)} />
          </FieldWrapper>
          <FieldWrapper label="Driver phone" htmlFor="driverPhone" required>
            <Input id="driverPhone" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} />
          </FieldWrapper>
          <FieldWrapper label="Estimated arrival" htmlFor="eta" error={formError ?? undefined} required>
            <Input id="eta" type="datetime-local" value={eta} onChange={(e) => setEta(e.target.value)} hasError={!!formError} />
          </FieldWrapper>
        </div>
      </Modal>
    </div>
  );
}
