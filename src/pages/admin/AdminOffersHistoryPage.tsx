import { useFetch } from "@/hooks/useFetch";
import { listOffers } from "@/mocks/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import type { SupplierOffer } from "@/types/domain";

export function AdminOffersHistoryPage() {
  const { data: offers, isLoading, error, refetch } = useFetch(
    () => listOffers({ status: ["accepted", "refused"] }),
    [],
  );

  const sorted = [...(offers ?? [])].sort(
    (a, b) => new Date(b.decidedAt ?? b.submittedAt).getTime() - new Date(a.decidedAt ?? a.submittedAt).getTime(),
  );

  const columns: Column<SupplierOffer>[] = [
    { key: "product", header: "Product", render: (o) => (
      <div>
        <p className="font-medium text-primary">{o.productName}</p>
        <p className="text-xs text-slate-400">{o.supplierName}</p>
      </div>
    ) },
    { key: "quantity", header: "Target qty", render: (o) => `${formatNumber(o.targetQuantity)} ${o.unit}` },
    { key: "price", header: "Unit price", render: (o) => formatCurrency(o.unitPrice) },
    { key: "decided", header: "Decided", render: (o) => (o.decidedAt ? formatDate(o.decidedAt) : "—") },
    { key: "status", header: "Status", render: (o) => <StatusBadge status={o.status} /> },
  ];

  return (
    <div>
      <PageHeader title="Offers History" description="Previously accepted or refused supplier offers." />
      {error ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={sorted}
          rowKey={(o) => o.id}
          isLoading={isLoading}
          emptyTitle="No processed offers yet"
          renderMobileTitle={(o) => o.productName}
        />
      )}
    </div>
  );
}
