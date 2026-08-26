import { useNavigate } from "react-router-dom";
import { useFetch } from "@/hooks/useFetch";
import { listPools } from "@/mocks/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatDate, formatNumber, poolProgress } from "@/lib/utils";
import type { Pool } from "@/types/domain";

export function AdminActivePoolsPage() {
  const navigate = useNavigate();
  const { data: pools, isLoading, error, refetch } = useFetch(() => listPools({ status: "active" }), []);

  const columns: Column<Pool>[] = [
    { key: "product", header: "Product", render: (p) => (
      <div>
        <p className="font-medium text-primary">{p.productName}</p>
        <p className="text-xs text-slate-400">{p.supplierName}</p>
      </div>
    ) },
    { key: "progress", header: "Progress", render: (p) => (
      <div className="w-36">
        <div className="mb-1 flex justify-between text-xs text-slate-500">
          <span>{formatNumber(p.currentQuantity)}/{formatNumber(p.targetQuantity)} {p.unit}</span>
        </div>
        <ProgressBar value={poolProgress(p.currentQuantity, p.targetQuantity)} />
      </div>
    ) },
    { key: "participants", header: "Retailers", render: (p) => p.participantCount },
    { key: "deadline", header: "Deadline", render: (p) => formatDate(p.deadline) },
    { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
  ];

  return (
    <div>
      <PageHeader title="Active Pools" description="All pools currently accepting retailer contributions, across every supplier." />
      {error ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={pools ?? []}
          rowKey={(p) => p.id}
          isLoading={isLoading}
          emptyTitle="No active pools"
          renderMobileTitle={(p) => p.productName}
          onRowClick={(p) => navigate(`/admin/pools/${p.id}`)}
        />
      )}
    </div>
  );
}
