import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useFetch } from "@/hooks/useFetch";
import { getPool, joinPool, listPoolParticipants } from "@/mocks/api";
import { PoolOverview } from "@/components/domain/PoolOverview";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FieldWrapper, Input } from "@/components/ui/Field";
import { PageSpinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { RetailerUser } from "@/types/domain";

export function PoolDetailPage() {
  const { poolId } = useParams<{ poolId: string }>();
  const { user } = useAuth();
  const retailer = user as RetailerUser;

  const { data: pool, isLoading, error, refetch } = useFetch(() => getPool(poolId!), [poolId]);
  const { data: participants, refetch: refetchParticipants } = useFetch(
    () => listPoolParticipants(poolId!),
    [poolId],
  );

  const [joinOpen, setJoinOpen] = useState(false);
  const [quantity, setQuantity] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (isLoading) return <PageSpinner label="Loading pool details…" />;
  if (error || !pool) return <ErrorState title="Pool not found" description="This pool may no longer be available." onRetry={refetch} />;

  const remaining = Math.max(0, pool.targetQuantity - pool.currentQuantity);

  const openJoinModal = () => {
    setQuantity(String(pool.minContribution));
    setFormError(null);
    setJoinOpen(true);
  };

  const handleJoin = async () => {
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      setFormError("Enter a valid quantity.");
      return;
    }
    if (qty < pool.minContribution) {
      setFormError(`Minimum contribution is ${formatNumber(pool.minContribution)} ${pool.unit}.`);
      return;
    }
    if (qty > remaining) {
      setFormError(`Only ${formatNumber(remaining)} ${pool.unit} remaining in this pool.`);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await joinPool({
        poolId: pool.id,
        retailerId: retailer.id,
        retailerName: retailer.businessName,
        quantity: qty,
      });
      setJoinOpen(false);
      setSuccessMessage(`You joined this pool with ${formatNumber(qty)} ${pool.unit}.`);
      refetch();
      refetchParticipants();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not join this pool.");
    } finally {
      setSubmitting(false);
    }
  };

  const estimatedTotal = Number(quantity) > 0 ? Number(quantity) * pool.unitPrice : 0;

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/retailer/pools" className="mb-4 inline-block text-sm font-medium text-tertiary hover:underline">
        &larr; Back to pools
      </Link>

      {successMessage && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMessage}
        </div>
      )}

      <PoolOverview pool={pool} participants={participants ?? undefined}>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-sm font-medium text-primary">What happens after the pool is met?</p>
          <p className="text-sm text-slate-500">
            Once the target quantity is reached, the supplier prepares the order and an administrator assigns a
            delivery. You'll be notified at every step and can track delivery progress from{" "}
            <Link to="/retailer/track" className="text-tertiary hover:underline">
              Track Deliveries
            </Link>
            .
          </p>
        </div>

        {pool.status === "active" && (
          <Button size="lg" className="w-full sm:w-auto" onClick={openJoinModal}>
            Join this pool
          </Button>
        )}
      </PoolOverview>

      <Modal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        title="Join this pool"
        description={`Enter how many ${pool.unit} you'd like to contribute.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setJoinOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleJoin} isLoading={submitting}>
              Confirm join
            </Button>
          </>
        }
      >
        <FieldWrapper
          label={`Quantity (${pool.unit})`}
          htmlFor="join-quantity"
          error={formError ?? undefined}
          hint={`Min. ${formatNumber(pool.minContribution)} · Max. ${formatNumber(remaining)} remaining`}
          required
        >
          <Input
            id="join-quantity"
            type="number"
            min={pool.minContribution}
            max={remaining}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            hasError={!!formError}
          />
        </FieldWrapper>
        {estimatedTotal > 0 && (
          <p className="mt-3 text-sm text-slate-500">
            Estimated total: <span className="font-medium text-primary">{formatCurrency(estimatedTotal)}</span>
          </p>
        )}
      </Modal>
    </div>
  );
}
