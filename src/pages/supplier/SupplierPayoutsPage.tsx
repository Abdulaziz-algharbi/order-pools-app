import { useFetch } from "@/hooks/useFetch";
import { listPayouts, listPools } from "@/mocks/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { SupplierPayout } from "@/types/domain";

// Role-scoped server-side to payouts for pools built from this supplier's
// own offers (see supplier.payouts.controller.ts) — no client-side
// filtering needed.
export function SupplierPayoutsPage() {
  const { data: payouts, isLoading, error, refetch } = useFetch(() => listPayouts(), []);
  const { data: pools } = useFetch(() => listPools(), []);

  const poolName = (poolId: string) => (pools ?? []).find((p) => p._id === poolId)?.productName ?? poolId;

  const columns: Column<SupplierPayout>[] = [
    { key: "pool", header: "Pool", render: (p) => poolName(p.pool_ref) },
    { key: "amount", header: "Amount owed", render: (p) => formatCurrency(p.amount) },
    { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
    {
      key: "reference",
      header: "Transaction ref.",
      render: (p) => p.transactionReference ?? "—",
      hideOnMobileCard: true,
    },
    { key: "paidAt", header: "Paid", render: (p) => (p.paidAt ? formatDate(p.paidAt) : "—") },
  ];

  return (
    <div>
      <PageHeader title="Payouts" description="What you're owed for completed pools, and their payment status." />

      {error ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={payouts ?? []}
          rowKey={(p) => p._id}
          isLoading={isLoading}
          emptyTitle="No payouts yet"
          emptyDescription="A payout appears here automatically once one of your pools is fully delivered."
          renderMobileTitle={(p) => poolName(p.pool_ref)}
        />
      )}
    </div>
  );
}
