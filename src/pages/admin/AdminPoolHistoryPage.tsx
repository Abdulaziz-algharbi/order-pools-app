import { useNavigate } from "react-router-dom";
import { useFetch } from "@/hooks/useFetch";
import { listPools } from "@/mocks/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import type { Pool } from "@/types/domain";

export function AdminPoolHistoryPage() {
  const navigate = useNavigate();
  const { data: pools, isLoading, error, refetch } = useFetch(
    () => listPools({ status: ["COMPLETED", "CANCELLED"] }),
    [],
  );

  const columns: Column<Pool>[] = [
    {
      key: "product",
      header: "Product",
      render: (p) => (
        <div>
          <p className="font-medium text-primary">{p.productName}</p>
          <p className="text-xs text-slate-400">{p.supplierName}</p>
        </div>
      ),
    },
    {
      key: "value",
      header: "Total value",
      render: (p) => formatCurrency((p.targetQuantity - p.currentQuantity) * p.pricePerUnit),
    },
    {
      key: "quantity",
      header: "Quantity",
      render: (p) => `${formatNumber(p.targetQuantity - p.currentQuantity)} ${p.unit.toLowerCase()}`,
    },
    { key: "participants", header: "Retailers", render: (p) => p.participantCount },
    { key: "deadline", header: "Deadline", render: (p) => formatDate(p.endDate) },
    { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status} domain="pool" /> },
  ];

  return (
    <div>
      <PageHeader title="Pool History" description="Pools that have completed or been cancelled, across all suppliers." />
      {error ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={pools ?? []}
          rowKey={(p) => p._id}
          isLoading={isLoading}
          emptyTitle="No historical pools yet"
          renderMobileTitle={(p) => p.productName}
          onRowClick={(p) => navigate(`/admin/pools/${p._id}`)}
        />
      )}
    </div>
  );
}
