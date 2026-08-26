import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useFetch } from "@/hooks/useFetch";
import { assignDelivery, getPool, listPoolParticipants } from "@/mocks/api";
import { PoolOverview } from "@/components/domain/PoolOverview";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FieldWrapper, Input } from "@/components/ui/Field";
import { PageSpinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatDateTime } from "@/lib/utils";

export function AdminPoolDetailPage() {
  const { poolId } = useParams<{ poolId: string }>();
  const { data: pool, isLoading, error, refetch } = useFetch(() => getPool(poolId!), [poolId]);
  const { data: participants } = useFetch(() => listPoolParticipants(poolId!), [poolId]);

  const [assignOpen, setAssignOpen] = useState(false);
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [eta, setEta] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isLoading) return <PageSpinner label="Loading pool details…" />;
  if (error || !pool) return <ErrorState title="Pool not found" onRetry={refetch} />;

  const handleAssign = async () => {
    if (!driverName.trim() || !driverPhone.trim() || !eta) {
      setFormError("All fields are required.");
      return;
    }
    setSubmitting(true);
    try {
      await assignDelivery(pool.id, driverName.trim(), driverPhone.trim(), new Date(eta).toISOString());
      setAssignOpen(false);
      refetch();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not assign delivery.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/admin/pools" className="mb-4 inline-block text-sm font-medium text-tertiary hover:underline">
        &larr; Back to pools
      </Link>

      <PoolOverview pool={pool} participants={participants ?? undefined}>
        {pool.delivery && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <p className="mb-2 font-medium text-primary">Delivery</p>
            {pool.delivery.driverName && (
              <p className="text-slate-600">
                Driver: <span className="font-medium text-primary">{pool.delivery.driverName}</span>
                {pool.delivery.driverPhone && ` · ${pool.delivery.driverPhone}`}
              </p>
            )}
            {pool.delivery.estimatedArrival && (
              <p className="mt-1 text-slate-600">ETA: {formatDateTime(pool.delivery.estimatedArrival)}</p>
            )}
            {pool.delivery.deliveredAt && (
              <p className="mt-1 text-slate-600">Delivered {formatDateTime(pool.delivery.deliveredAt)}</p>
            )}
          </div>
        )}

        {pool.status === "met" && (
          <Button onClick={() => setAssignOpen(true)}>Assign delivery</Button>
        )}
      </PoolOverview>

      <Modal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Assign delivery"
        description={`Assign a driver to fulfill ${pool.productName}.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setAssignOpen(false)} disabled={submitting}>
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
