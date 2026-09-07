import { useNavigate } from "react-router-dom";
import { useFetch } from "@/hooks/useFetch";
import { listOffers } from "@/mocks/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LinkButton } from "@/components/ui/LinkButton";
import { ErrorState } from "@/components/ui/ErrorState";
import { PlusIcon } from "@/components/ui/icons";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import type { ProductOffer } from "@/types/domain";

export function SupplierOffersPage() {
  const navigate = useNavigate();

  const { data: offers, isLoading, error, refetch } = useFetch(() => listOffers(), []);

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
    { key: "submitted", header: "Submitted", render: (o) => formatDate(o.createdAt) },
    { key: "status", header: "Status", render: (o) => <StatusBadge status={o.status} domain="offer" /> },
  ];

  return (
    <div>
      <PageHeader
        title="Offers"
        description="Wholesale opportunities you've proposed and their review status."
        action={
          <LinkButton to="/supplier/offers/new">
            <PlusIcon className="h-4 w-4" /> New offer
          </LinkButton>
        }
      />

      {error ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={offers ?? []}
          rowKey={(o) => o._id}
          isLoading={isLoading}
          emptyTitle="No offers submitted yet"
          emptyDescription="Submit your first wholesale offer to start a pool."
          renderMobileTitle={(o) => o.name}
          onRowClick={(o) => navigate(`/supplier/offers/${o._id}`)}
        />
      )}
    </div>
  );
}
