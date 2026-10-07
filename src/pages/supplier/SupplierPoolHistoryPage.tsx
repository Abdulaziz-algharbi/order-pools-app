import { useNavigate } from "react-router-dom";
import { useFetch } from "@/hooks/useFetch";
import { listPayouts, listPools } from "@/services/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatDate, formatNumber } from "@/lib/utils";
import { formatOmrAmount } from "@/lib/pool-pricing";
import type { Pool } from "@/types/domain";

export function SupplierPoolHistoryPage() {
  const navigate = useNavigate();

  const { data: pools, isLoading, error, refetch } = useFetch(
    () => listPools({ status: ["COMPLETED", "CANCELLED"] }),
    [],
  );

  // What the supplier is paid for each pool: the offer's whole price, as a
  // payout created once the pool's delivery is DELIVERED. Not the retail
  // value retailers paid at the admin's lot price — that's the platform's
  // business. If payouts can't be loaded, only this column goes blank.
  const { data: payouts } = useFetch(() => listPayouts(), []);
  const payoutByPool = new Map((payouts ?? []).map((payout) => [payout.pool_ref, payout]));

  const sorted = [...(pools ?? [])].sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());

  const columns: Column<Pool>[] = [
    {
      key: "product",
      header: "Product",
      render: (p) => {
        const collected = p.targetQuantity - p.currentQuantity;
        return (
          <div>
            <p className="font-medium text-primary">{p.productName}</p>
            <p className="text-xs text-slate-400">
              {formatNumber(collected)} {p.unit.toLowerCase()} collected
            </p>
          </div>
        );
      },
    },
    {
      key: "payout",
      header: "Your payout",
      render: (p) => {
        const payout = payoutByPool.get(p._id);
        if (payout) {
          return (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-primary">{formatOmrAmount(payout.amount)}</span>
              <StatusBadge status={payout.status} />
            </div>
          );
        }
        return p.status === "CANCELLED" ? "No payout (cancelled)" : "—";
      },
    },
    { key: "participants", header: "Retailers", render: (p) => p.participantCount },
    { key: "closed", header: "Deadline", render: (p) => formatDate(p.endDate) },
    { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status} domain="pool" /> },
  ];

  return (
    <div>
      <PageHeader title="Pool History" description="Pools you've supplied that have completed or been cancelled." />
      {error ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={sorted}
          rowKey={(p) => p._id}
          isLoading={isLoading}
          emptyTitle="No pool history yet"
          emptyDescription="Pools that have completed will appear here."
          renderMobileTitle={(p) => p.productName}
          onRowClick={(p) => navigate(`/supplier/pools/${p._id}`)}
        />
      )}
    </div>
  );
}
