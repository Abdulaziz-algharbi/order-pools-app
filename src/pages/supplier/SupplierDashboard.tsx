import { useAuth } from "@/context/AuthContext";
import { useFetch } from "@/hooks/useFetch";
import { listOffers, listPools } from "@/mocks/api";
import { useNotifications } from "@/hooks/useNotifications";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { PoolCard } from "@/components/domain/PoolCard";
import { LinkButton } from "@/components/ui/LinkButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Spinner";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PackageIcon, PlusIcon } from "@/components/ui/icons";
import { poolProgress } from "@/lib/utils";
import type { SupplierUser } from "@/types/domain";

export function SupplierDashboard() {
  const { user } = useAuth();
  const supplier = user as SupplierUser;

  const { data: offers, isLoading: offersLoading } = useFetch(
    () => listOffers({ supplierId: supplier.id }),
    [supplier.id],
  );
  const { data: pools, isLoading: poolsLoading } = useFetch(
    () => listPools({ supplierId: supplier.id, status: "active" }),
    [supplier.id],
  );
  const { notifications } = useNotifications(supplier.id);

  const pendingOffers = (offers ?? []).filter((o) => o.status === "pending_review" || o.status === "negotiation");
  const readyToFulfill = (pools ?? []).filter((p) => poolProgress(p.currentQuantity, p.targetQuantity) >= 80);

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back, ${supplier.companyName}`}
        description="Here's what needs your attention today."
        action={
          <LinkButton to="/supplier/offers/new">
            <PlusIcon className="h-4 w-4" /> New offer
          </LinkButton>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Active pools</p>
            <p className="mt-1 font-heading text-2xl font-semibold text-primary">{pools?.length ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Offers awaiting decision</p>
            <p className="mt-1 font-heading text-2xl font-semibold text-primary">{pendingOffers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Unread notifications</p>
            <p className="mt-1 font-heading text-2xl font-semibold text-primary">
              {notifications.filter((n) => !n.read).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {pendingOffers.length > 0 && (
        <section>
          <PageHeader title="Offers awaiting admin decision" />
          <Card className="overflow-hidden p-0">
            <div className="divide-y divide-slate-100">
              {pendingOffers.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-primary">{o.productName}</p>
                    <p className="text-xs text-slate-400">Submitted {new Date(o.submittedAt).toLocaleDateString()}</p>
                  </div>
                  <StatusBadge status={o.status} />
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}

      <section>
        <PageHeader
          title="Prepare for fulfillment"
          description="These pools are close to their target — start preparing products."
        />
        {poolsLoading || offersLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        ) : readyToFulfill.length === 0 ? (
          <EmptyState
            icon={<PackageIcon className="h-8 w-8" />}
            title="No pools close to fulfillment yet"
            description="You'll see pools here once they're close to their target quantity."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {readyToFulfill.map((pool) => (
              <PoolCard key={pool.id} pool={pool} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
