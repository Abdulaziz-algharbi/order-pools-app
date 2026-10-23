import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useFetch } from "@/hooks/useFetch";
import { listOffersPage } from "@/services/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ErrorState } from "@/components/ui/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { PackageIcon } from "@/components/ui/icons";
import { formatDate, formatNumber } from "@/lib/utils";
import { formatOmrAmount } from "@/lib/pool-pricing";
import { cldUrl } from "@/lib/cloudinary";
import type { ProductOffer } from "@/types/domain";

const OFFERS_HISTORY_PAGE_SIZE = 20;

// ?page= in the URL, so a refresh or the back button keeps the page.
function pageFromParams(params: URLSearchParams): number {
  const page = Number(params.get("page"));
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

export function AdminOffersHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = pageFromParams(searchParams);
  const { data, isLoading, error, refetch } = useFetch(
    () => listOffersPage({ status: ["APPROVED", "REJECTED"] }, page, OFFERS_HISTORY_PAGE_SIZE),
    [page],
  );

  const goToPage = (next: number) => {
    setSearchParams(next === 1 ? {} : { page: String(next) });
    window.scrollTo?.({ top: 0 });
  };

  // A page past the end (an old link, or offers deleted since) shows the
  // last page instead of an empty table.
  useEffect(() => {
    if (data && page > data.pageCount) {
      setSearchParams(data.pageCount === 1 ? {} : { page: String(data.pageCount) }, { replace: true });
    }
  }, [data, page, setSearchParams]);

  const columns: Column<ProductOffer>[] = [
    {
      key: "product",
      header: "Product",
      render: (o) => (
        <div className="flex items-center gap-3">
          {o.images?.[0] ? (
            <img
              src={cldUrl(o.images[0], "thumb")}
              alt={o.name}
              loading="lazy"
              className="h-10 w-10 shrink-0 rounded-md object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100">
              <PackageIcon role="img" aria-label="No product image" className="h-5 w-5 text-slate-300" />
            </div>
          )}
          <div>
            <p className="font-medium text-primary">{o.name}</p>
            {o.brand && <p className="text-xs text-slate-400">{o.brand}</p>}
          </div>
        </div>
      ),
    },
    { key: "quantity", header: "Quantity", render: (o) => `${formatNumber(o.wholeQuantity)} ${o.unit.toLowerCase()}` },
    { key: "price", header: "Total price", render: (o) => formatOmrAmount(o.totalWholesalePrice) },
    { key: "updated", header: "Updated", render: (o) => formatDate(o.updatedAt) },
    { key: "status", header: "Status", render: (o) => <StatusBadge status={o.status} domain="offer" /> },
  ];

  return (
    <div>
      <PageHeader title="Offers History" description="Previously approved or rejected supplier offers." />
      {error ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            rowKey={(o) => o._id}
            isLoading={isLoading}
            emptyTitle="No processed offers yet"
            renderMobileTitle={(o) => o.name}
          />
          {data && <Pagination page={page} pageCount={data.pageCount} onPageChange={goToPage} />}
        </>
      )}
    </div>
  );
}
