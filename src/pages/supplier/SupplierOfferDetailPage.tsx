import { Link, useParams } from "react-router-dom";
import { useFetch } from "@/hooks/useFetch";
import { getOffer } from "@/mocks/api";
import { Card, CardContent } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageSpinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";

export function SupplierOfferDetailPage() {
  const { offerId } = useParams<{ offerId: string }>();
  const { data: offer, isLoading, error, refetch } = useFetch(() => getOffer(offerId!), [offerId]);

  if (isLoading) return <PageSpinner label="Loading offer…" />;
  if (error || !offer) return <ErrorState title="Offer not found" onRetry={refetch} />;

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/supplier/offers" className="mb-4 inline-block text-sm font-medium text-tertiary hover:underline">
        &larr; Back to offers
      </Link>

      <Card>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              {offer.brand && (
                <p className="text-sm font-medium uppercase tracking-wide text-slate-400">{offer.brand}</p>
              )}
              <h1 className="mt-1 font-heading text-2xl font-semibold text-primary">{offer.name}</h1>
            </div>
            <StatusBadge status={offer.status} domain="offer" />
          </div>

          <p className="text-slate-600">{offer.description}</p>

          <dl className="grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-slate-400">Quantity</dt>
              <dd className="font-heading text-lg font-semibold text-primary">
                {formatNumber(offer.wholeQuantity)} {offer.unit.toLowerCase()}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Price</dt>
              <dd className="font-heading text-lg font-semibold text-primary">
                {formatCurrency(offer.price)} / {offer.unit.toLowerCase()}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Submitted</dt>
              <dd className="font-heading text-lg font-semibold text-primary">{formatDate(offer.createdAt)}</dd>
            </div>
          </dl>

          {offer.adminComment && (
            <div className="rounded-lg border border-tertiary/20 bg-tertiary/5 p-4">
              <p className="text-sm font-medium text-primary">Note from admin</p>
              <p className="mt-1 text-sm text-slate-600">{offer.adminComment}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
