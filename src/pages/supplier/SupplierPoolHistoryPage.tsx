import { useNavigate } from "react-router-dom";
import { useFetch } from "@/hooks/useFetch";
import { listPools } from "@/mocks/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import type { Pool } from "@/types/domain";

export function SupplierPoolHistoryPage() {
  const navigate = useNavigate();

  const { data: pools, isLoading, error, refetch } = useFetch(
    () => listPools({ status: ["COMPLETED", "CANCELLED"] }),
    [],
  );

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
      key: "revenue",
      header: "Total value",
      render: (p) => formatCurrency((p.targetQuantity - p.currentQuantity) * p.pricePerUnit),
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
