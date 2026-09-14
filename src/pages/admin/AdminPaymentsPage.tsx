import { useEffect, useState } from "react";
import { useFetch } from "@/hooks/useFetch";
import { confirmRefund, getUserById, listPayments, listPools, retryRefund } from "@/services/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Payment } from "@/types/domain";

// Every payment platform-wide (listPayments == listMyPayments, but ADMIN
// sees everyone's server-side — see payments.controller.ts). This page
// exists mainly for the two refund follow-up actions below; Thawani's
// refund-status response schema isn't confirmed from documentation, so
// confirming one completed is a deliberate manual admin action rather
// than an automatic poll (see thawani.gateway.ts).
export function AdminPaymentsPage() {
  const { data: payments, isLoading, error, refetch } = useFetch(() => listPayments(), []);
  const { data: pools } = useFetch(() => listPools(), []);
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    if (!payments || payments.length === 0) return;
    const uniqueIds = [...new Set(payments.map((p) => p.user_ref))];
    Promise.all(uniqueIds.map((id) => getUserById(id).catch(() => null))).then((users) => {
      setUserNames(
        new Map(users.filter((u): u is NonNullable<typeof u> => !!u).map((u) => [u._id, u.companyName])),
      );
    });
  }, [payments]);

  const poolName = (poolId: string) => (pools ?? []).find((p) => p._id === poolId)?.productName ?? poolId;

  const handleRetry = async (payment: Payment) => {
    setActionId(payment._id);
    try {
      await retryRefund(payment._id);
      refetch();
    } finally {
      setActionId(null);
    }
  };

  const handleConfirm = async (payment: Payment) => {
    setActionId(payment._id);
    try {
      await confirmRefund(payment._id);
      refetch();
    } finally {
      setActionId(null);
    }
  };

  const columns: Column<Payment>[] = [
    {
      key: "retailer",
      header: "Retailer",
      render: (p) => userNames.get(p.user_ref) ?? "…",
    },
    { key: "pool", header: "Pool", render: (p) => poolName(p.pool_ref), hideOnMobileCard: true },
    { key: "amount", header: "Amount", render: (p) => formatCurrency(p.amount) },
    { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
    { key: "since", header: "Since", render: (p) => formatDate(p.updatedAt) },
    {
      key: "actions",
      header: "",
      render: (p) => {
        if (p.status === "REFUND_FAILED") {
          return (
            <Button size="sm" variant="outline" onClick={() => handleRetry(p)} isLoading={actionId === p._id}>
              Retry refund
            </Button>
          );
        }
        if (p.status === "REFUND_PENDING") {
          return (
            <Button size="sm" onClick={() => handleConfirm(p)} isLoading={actionId === p._id}>
              Confirm refunded
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
        title="Payments"
        description="Every retailer payment platform-wide, and refund follow-up for the ones that need it."
      />

      {error ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={payments ?? []}
          rowKey={(p) => p._id}
          isLoading={isLoading}
          emptyTitle="No payments yet"
          renderMobileTitle={(p) => userNames.get(p.user_ref) ?? poolName(p.pool_ref)}
        />
      )}
    </div>
  );
}
