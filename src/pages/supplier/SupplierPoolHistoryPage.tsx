import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useFetch } from "@/hooks/useFetch";
import { listPools } from "@/mocks/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import type { Pool, SupplierUser } from "@/types/domain";

export function SupplierPoolHistoryPage() {
  const { user } = useAuth();
  const supplier = user as SupplierUser;
  const navigate = useNavigate();

  const { data: pools, isLoading, error, refetch } = useFetch(
    () => listPools({ supplierId: supplier.id, status: ["met", "delivery_assigned", "delivered", "closed"] }),
    [supplier.id],
  );

  const sorted = [...(pools ?? [])].sort((a, b) => new Date(b.deadline).getTime() - new Date(a.deadline).getTime());

  const columns: Column<Pool>[] = [
    { key: "product", header: "Product", render: (p) => (
      <div>
        <p className="font-medium text-primary">{p.productName}</p>
        <p className="text-xs text-slate-400">{formatNumber(p.currentQuantity)} {p.unit} collected</p>
      </div>
    ) },
    { key: "revenue", header: "Total value", render: (p) => formatCurrency(p.currentQuantity * p.unitPrice) },
    { key: "participants", header: "Retailers", render: (p) => p.participantCount },
    { key: "closed", header: "Deadline", render: (p) => formatDate(p.deadline) },
    { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
  ];

  return (
    <div>
      <PageHeader title="Pool History" description="Pools you've supplied that have been met, delivered, or closed." />
      {error ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={sorted}
          rowKey={(p) => p.id}
          isLoading={isLoading}
          emptyTitle="No pool history yet"
          emptyDescription="Pools that have been met or delivered will appear here."
          renderMobileTitle={(p) => p.productName}
          onRowClick={(p) => navigate(`/supplier/pools/${p.id}`)}
        />
      )}
    </div>
  );
}
