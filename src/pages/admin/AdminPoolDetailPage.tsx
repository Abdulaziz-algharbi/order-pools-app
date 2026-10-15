import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useFetch } from "@/hooks/useFetch";
import {
  cancelPool,
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
import { apiErrorMessage } from "@/lib/http";
import type { Delivery, Pool } from "@/types/domain";

// Both close a pool and refund every retailer who paid (the backend's
// cancelAndRefund): expiring one that missed its end date, or an admin
// cancelling one still open or full but not yet in delivery.
type CloseAction = "expire" | "cancel";

const CLOSE_TEXT: Record<CloseAction, { button: string; title: string; done: string }> = {
  expire: { button: "Expire pool", title: "Expire this pool?", done: "Pool expired" },
  cancel: { button: "Cancel pool", title: "Cancel this pool?", done: "Pool cancelled" },
};

function closeDescription(action: CloseAction, pool: Pool): string {
  const why =
    action === "expire"
      ? "This pool never reached its target before its end date."
      : "It closes for good: it can't be reopened, and the supplier is told.";
  const paid =
    pool.participantCount > 0
      ? `${pool.participantCount} retailer(s) have paid; each gets a full refund.`
      : "No retailer has paid yet, so there's nothing to refund.";
  return `${why} ${paid} Checkouts still in progress are cancelled.`;
}

export function AdminPoolDetailPage() {
  const { poolId } = useParams<{ poolId: string }>();
  const { data: pool, isLoading, error, refetch } = useFetch(() => getPool(poolId!), [poolId]);
  const { data: participants } = useFetch(() => listPoolParticipants(poolId!), [poolId]);
  const { data: deliveries, refetch: refetchDeliveries } = useFetch(() => listDeliveries(), []);

  const [rows, setRows] = useState<PoolParticipantRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [closeAction, setCloseAction] = useState<CloseAction | null>(null);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closeResult, setCloseResult] = useState<{
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
  // PoolController.cancel()'s guard: not once a delivery has started. A
  // pool past its end date is expired instead, which says why.
  const canCancel = !canExpire && (pool.status === "OPEN" || pool.status === "TARGET_REACHED");

  const openClose = (action: CloseAction) => {
    setCloseAction(action);
    setCloseError(null);
    setCloseResult(null);
  };

  const closeModal = () => {
    if (closing) return;
    setCloseAction(null);
  };

  const handleClose = async () => {
    if (!closeAction) return;
    setClosing(true);
    setCloseError(null);
    try {
      const result = closeAction === "expire" ? await expirePool(pool._id) : await cancelPool(pool._id);
      setCloseResult({ refundsRequested: result.refundsRequested, refundsFailed: result.refundsFailed });
    } catch (e) {
      setCloseError(apiErrorMessage(e, "Something went wrong. Please try again."));
    } finally {
      setClosing(false);
      // Even a refused one: the pool may have moved on (a delivery started).
      refetch();
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/admin/pools" className="mb-4 inline-block text-sm font-medium text-tertiary hover:underline">
        &larr; Back to pools
      </Link>

      <PoolOverview pool={pool} participants={rowsLoading ? undefined : rows} pricingLocked>
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
          <Button variant="danger" onClick={() => openClose("expire")}>
            Expire pool
          </Button>
        )}
        {canCancel && (
          <Button variant="danger" onClick={() => openClose("cancel")}>
            Cancel pool
          </Button>
        )}
      </PoolOverview>

      {closeAction && (
        <Modal
          open
          onClose={closeModal}
          title={closeResult ? CLOSE_TEXT[closeAction].done : CLOSE_TEXT[closeAction].title}
          description={
            closeResult
              ? `Cancelled. ${closeResult.refundsRequested} refund(s) requested${
                  closeResult.refundsFailed > 0
                    ? `, ${closeResult.refundsFailed} failed and need a retry from Payments`
                    : ""
                }.`
              : closeDescription(closeAction, pool)
          }
          footer={
            closeResult ? (
              <Button onClick={() => setCloseAction(null)}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={closeModal} disabled={closing}>
                  Keep it open
                </Button>
                <Button variant="danger" onClick={handleClose} isLoading={closing}>
                  {CLOSE_TEXT[closeAction].button}
                </Button>
              </>
            )
          }
        >
          {closeError && (
            <p role="alert" className="text-sm text-red-600">
              {closeError}
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
