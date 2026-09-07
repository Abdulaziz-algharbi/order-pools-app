import { useFetch } from "@/hooks/useFetch";
import { listOffers } from "@/mocks/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import type { ProductOffer } from "@/types/domain";

export function AdminOffersHistoryPage() {
  const { data: offers, isLoading, error, refetch } = useFetch(
    () => listOffers({ status: ["APPROVED", "REJECTED"] }),
    [],
  );

  const columns: Column<ProductOffer>[] = [
    {
      key: "product",
      header: "Product",
      render: (o) => (
        <div>
          <p className="font-medium text-primary">{o.name}</p>
          {o.brand && <p className="text-xs text-slate-400">{o.brand}</p>}
        </div>
      ),
    },
    { key: "quantity", header: "Quantity", render: (o) => `${formatNumber(o.wholeQuantity)} ${o.unit.toLowerCase()}` },
    { key: "price", header: "Price", render: (o) => formatCurrency(o.price) },
    { key: "updated", header: "Updated", render: (o) => formatDate(o.updatedAt) },
    { key: "status", header: "Status", render: (o) => <StatusBadge status={o.status} domain="offer" /> },
  ];

  return (
    <div>
      <PageHeader title="Offers History" description="Previously approved or rejected supplier offers." />
      {error ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={offers ?? []}
          rowKey={(o) => o._id}
          isLoading={isLoading}
          emptyTitle="No processed offers yet"
          renderMobileTitle={(o) => o.name}
        />
      )}
    </div>
  );
}
