import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFetch } from "@/hooks/useFetch";
import { cancelPayment, listMyParticipants, listMyPayments, listPools, withdrawParticipant } from "@/mocks/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ErrorState } from "@/components/ui/ErrorState";
import { LinkButton } from "@/components/ui/LinkButton";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { canWithdrawFromPool, formatCurrency, formatDate, formatNumber, poolProgress } from "@/lib/utils";
import type { Payment, Pool, PoolParticipant } from "@/types/domain";

interface JoinRow {
  participant: PoolParticipant;
  pool: Pool;
  payment?: Payment;
}

export function MyJoinsPage() {
  const navigate = useNavigate();

  const {
    data: participants,
    isLoading: participantsLoading,
    error,
    refetch,
  } = useFetch(() => listMyParticipants(), []);
  const { data: pools, isLoading: poolsLoading } = useFetch(() => listPools(), []);
  const { data: payments, isLoading: paymentsLoading, refetch: refetchPayments } = useFetch(
    () => listMyPayments(),
    [],
  );

  const [leaveTarget, setLeaveTarget] = useState<JoinRow | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<JoinRow | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const isLoading = participantsLoading || poolsLoading || paymentsLoading;
  const rows: JoinRow[] = (participants ?? [])
    .map((participant): JoinRow | null => {
      const pool = (pools ?? []).find((p) => p._id === participant.pool_ref);
      if (!pool) return null;
      const payment = (payments ?? []).find((p) => p._id === participant.payment_ref);
      return { participant, pool, payment };
    })
    .filter((r): r is JoinRow => r !== null)
    .sort((a, b) => new Date(b.participant.createdAt).getTime() - new Date(a.participant.createdAt).getTime());

  const refetchAll = () => {
    refetch();
    refetchPayments();
  };

  const handleLeave = async () => {
    if (!leaveTarget) return;
    setLeaving(true);
    try {
      await withdrawParticipant(leaveTarget.participant._id);
      setLeaveTarget(null);
      refetchAll();
    } finally {
      setLeaving(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget?.payment) return;
    setCancelling(true);
    try {
      await cancelPayment(cancelTarget.payment._id);
      setCancelTarget(null);
      refetchAll();
    } finally {
      setCancelling(false);
    }
  };

  const columns: Column<JoinRow>[] = [
    {
      key: "product",
      header: "Product",
      render: (r) => (
        <div>
          <p className="font-medium text-primary">{r.pool.productName}</p>
          <p className="text-xs text-slate-400">{r.pool.supplierName}</p>
        </div>
      ),
      hideOnMobileCard: true,
    },
    {
      key: "contribution",
      header: "My contribution",
      render: (r) => `${formatNumber(r.participant.quantity)} ${r.pool.unit.toLowerCase()}`,
    },
    { key: "total", header: "Total", render: (r) => formatCurrency(r.participant.quantity * r.pool.pricePerUnit) },
    {
      key: "progress",
      header: "Pool progress",
      render: (r) => (
        <div className="w-32">
          <ProgressBar value={poolProgress(r.pool.targetQuantity - r.pool.currentQuantity, r.pool.targetQuantity)} />
        </div>
      ),
    },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.participant.status} domain="participant" /> },
    { key: "joined", header: "Joined", render: (r) => formatDate(r.participant.createdAt) },
    {
      key: "actions",
      header: "",
      render: (r) => {
        // A PENDING payment means the retailer never landed back on
        // PaymentResultPage (see joinPool/PoolDetailPage) — this is the
        // only other way back to that checkout, or out of it.
        if (r.payment?.status === "PENDING" && r.payment.checkoutUrl) {
          const checkoutUrl = r.payment.checkoutUrl;
          return (
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setCancelTarget(r);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  window.location.assign(checkoutUrl);
                }}
              >
                Resume checkout
              </Button>
            </div>
          );
        }
        if (canWithdrawFromPool(r.pool)) {
          return (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setLeaveTarget(r);
              }}
            >
              Leave
            </Button>
          );
        }
        return null;
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="My Joins"
        description="Pools you're currently participating in."
        action={<LinkButton to="/retailer/pools" variant="outline" size="sm">Browse pools</LinkButton>}
      />

      {error ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(r) => r.participant._id}
          isLoading={isLoading}
          emptyTitle="You haven't joined any pools yet"
          emptyDescription="Browse active pools and join one to start saving on wholesale prices."
          onRowClick={(r) => navigate(`/retailer/pools/${r.pool._id}`)}
          renderMobileTitle={(r) => r.pool.productName}
        />
      )}

      <Modal
        open={!!leaveTarget}
        onClose={() => setLeaveTarget(null)}
        title="Leave this pool?"
        description={
          leaveTarget
            ? `This releases your ${formatNumber(leaveTarget.participant.quantity)} ${leaveTarget.pool.unit.toLowerCase()} contribution to "${leaveTarget.pool.productName}". Any completed payment will be refunded.`
            : ""
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setLeaveTarget(null)} disabled={leaving}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleLeave} isLoading={leaving}>
              Leave pool
            </Button>
          </>
        }
      />

      <Modal
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Cancel this checkout?"
        description={
          cancelTarget
            ? `This cancels your pending payment for "${cancelTarget.pool.productName}" and releases the quantity you reserved. No charge was made.`
            : ""
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelTarget(null)} disabled={cancelling}>
              Keep it
            </Button>
            <Button variant="danger" onClick={handleCancel} isLoading={cancelling}>
              Cancel checkout
            </Button>
          </>
        }
      />
    </div>
  );
}
