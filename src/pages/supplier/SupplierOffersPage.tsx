import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useFetch } from "@/hooks/useFetch";
import { listOffers } from "@/mocks/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LinkButton } from "@/components/ui/LinkButton";
import { ErrorState } from "@/components/ui/ErrorState";
import { PlusIcon } from "@/components/ui/icons";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import type { SupplierOffer, SupplierUser } from "@/types/domain";

export function SupplierOffersPage() {
  const { user } = useAuth();
  const supplier = user as SupplierUser;
  const navigate = useNavigate();

  const { data: offers, isLoading, error, refetch } = useFetch(
    () => listOffers({ supplierId: supplier.id }),
    [supplier.id],
  );

  const sorted = [...(offers ?? [])].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  );

  const columns: Column<SupplierOffer>[] = [
    { key: "product", header: "Product", render: (o) => (
      <div>
        <p className="font-medium text-primary">{o.productName}</p>
        <p className="text-xs text-slate-400">{o.category}</p>
      </div>
    ) },
    { key: "quantity", header: "Target qty", render: (o) => `${formatNumber(o.targetQuantity)} ${o.unit}` },
    { key: "price", header: "Unit price", render: (o) => formatCurrency(o.unitPrice) },
    { key: "submitted", header: "Submitted", render: (o) => formatDate(o.submittedAt) },
    { key: "status", header: "Status", render: (o) => <StatusBadge status={o.status} /> },
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
          data={sorted}
          rowKey={(o) => o.id}
          isLoading={isLoading}
          emptyTitle="No offers submitted yet"
          emptyDescription="Submit your first wholesale offer to start a pool."
          renderMobileTitle={(o) => o.productName}
          onRowClick={(o) => navigate(`/supplier/offers/${o.id}`)}
        />
      )}
    </div>
  );
}
