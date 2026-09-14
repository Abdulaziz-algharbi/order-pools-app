import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useFetch } from "@/hooks/useFetch";
import {
  createDelivery,
  expirePool,
  getPool,
  getUserById,
  listPoolParticipants,
  updateDeliveryStatus,
  listDeliveries,
} from "@/services/api";
import { PoolOverview, type PoolParticipantRow } from "@/components/domain/PoolOverview";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PageSpinner, Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatNumber } from "@/lib/utils";
import type { Delivery } from "@/types/domain";

export function AdminPoolDetailPage() {
  const { poolId } = useParams<{ poolId: string }>();
  const { data: pool, isLoading, error, refetch } = useFetch(() => getPool(poolId!), [poolId]);
  const { data: participants } = useFetch(() => listPoolParticipants(poolId!), [poolId]);
  const { data: deliveries, refetch: refetchDeliveries } = useFetch(() => listDeliveries(), []);

  const [rows, setRows] = useState<PoolParticipantRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expireOpen, setExpireOpen] = useState(false);
  const [expiring, setExpiring] = useState(false);
  const [expireResult, setExpireResult] = useState<{
    refundsRequested: number;
    refundsFailed: number;
  } | null>(null);

  const delivery: Delivery | undefined = deliveries?.find((d) => d.pool_ref === poolId);

  useEffect(() => {
    if (!participants || participants.length === 0) {
      setRows([]);
      return;
    }
    setRowsLoading(true);
    const uniqueIds = [...new Set(participants.map((p) => p.user_ref))];
    Promise.all(uniqueIds.map((id) => getUserById(id).catch(() => null)))
      .then((users) => {
        const nameById = new Map(
          users.filter((u): u is NonNullable<typeof u> => !!u).map((u) => [u._id, u.companyName]),
        );
        setRows(
          participants.map((p) => ({
            key: p._id,
            label: nameById.get(p.user_ref) ?? "Unknown retailer",
            quantity: p.quantity,
          })),
        );
      })
      .finally(() => setRowsLoading(false));
  }, [participants]);

  if (isLoading) return <PageSpinner label="Loading pool details…" />;
  if (error || !pool) return <ErrorState title="Pool not found" onRetry={refetch} />;

  const handleStartDelivery = async () => {
    setBusy(true);
    try {
      await createDelivery(pool._id);
      refetch();
      refetchDeliveries();
    } finally {
      setBusy(false);
    }
  };

  const handleAdvanceDelivery = async (status: "DELIVERING" | "DELIVERED") => {
    if (!delivery) return;
    setBusy(true);
    try {
      await updateDeliveryStatus(delivery._id, status);
      refetch();
      refetchDeliveries();
    } finally {
      setBusy(false);
    }
  };

  // Only meaningful once the pool's own endDate has passed while it never
  // reached its target — mirrors PoolController.expirePool()'s own guard
  // (OPEN + endDate in the past) so this button never appears just to 409.
  const canExpire = pool.status === "OPEN" && new Date(pool.endDate).getTime() <= Date.now();

  const handleExpire = async () => {
    setExpiring(true);
    try {
      const result = await expirePool(pool._id);
      setExpireResult({ refundsRequested: result.refundsRequested, refundsFailed: result.refundsFailed });
      refetch();
    } finally {
      setExpiring(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/admin/pools" className="mb-4 inline-block text-sm font-medium text-tertiary hover:underline">
        &larr; Back to pools
      </Link>

      <PoolOverview pool={pool} participants={rowsLoading ? undefined : rows}>
        {rowsLoading && <Spinner className="h-5 w-5" />}

        {delivery && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <p className="mb-2 font-medium text-primary">Delivery</p>
            <p className="text-slate-600">
              Status: <span className="font-medium text-primary">{delivery.deliveryStatus}</span>
            </p>
            <p className="mt-1 text-slate-500">
              {formatNumber(pool.targetQuantity - pool.currentQuantity)} {pool.unit.toLowerCase()} for{" "}
              {pool.participantCount} retailers
            </p>
          </div>
        )}

        {pool.status === "TARGET_REACHED" && (
          <Button onClick={handleStartDelivery} isLoading={busy}>
            Start delivery
          </Button>
        )}
        {delivery?.deliveryStatus === "PENDING" && (
          <Button onClick={() => handleAdvanceDelivery("DELIVERING")} isLoading={busy}>
            Start transit
          </Button>
        )}
        {delivery?.deliveryStatus === "DELIVERING" && (
          <Button onClick={() => handleAdvanceDelivery("DELIVERED")} isLoading={busy}>
            Mark delivered
          </Button>
        )}
        {canExpire && (
          <Button variant="danger" onClick={() => setExpireOpen(true)}>
            Expire pool
          </Button>
        )}
      </PoolOverview>

      <Modal
        open={expireOpen}
        onClose={() => {
          if (expiring) return;
          setExpireOpen(false);
          setExpireResult(null);
        }}
        title={expireResult ? "Pool expired" : "Expire this pool?"}
        description={
          expireResult
            ? `Cancelled. ${expireResult.refundsRequested} refund(s) requested${
                expireResult.refundsFailed > 0 ? `, ${expireResult.refundsFailed} failed and need a manual retry` : ""
              }.`
            : "This pool never reached its target before its end date. Cancelling it sweeps any pending payments to failed and requests a refund for every completed one."
        }
        footer={
          expireResult ? (
            <Button
              onClick={() => {
                setExpireOpen(false);
                setExpireResult(null);
              }}
            >
              Done
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setExpireOpen(false)} disabled={expiring}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleExpire} isLoading={expiring}>
                Expire pool
              </Button>
            </>
          )
        }
      />
    </div>
  );
}
