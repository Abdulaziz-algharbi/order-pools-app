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
import { formatDate, poolProgress } from "@/lib/utils";

export function SupplierDashboard() {
  const { user } = useAuth();

  const { data: offers, isLoading: offersLoading } = useFetch(() => listOffers(), []);
  const { data: pools, isLoading: poolsLoading } = useFetch(() => listPools(), []);
  const { unreadCount } = useNotifications(user?._id);

  const pendingOffers = (offers ?? []).filter((o) => o.status === "PENDING" || o.status === "NEGOTIATION");
  const openPools = (pools ?? []).filter((p) => p.status === "OPEN");
  const readyToFulfill = openPools.filter(
    (p) => poolProgress(p.targetQuantity - p.currentQuantity, p.targetQuantity) >= 80,
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back, ${user?.companyName ?? ""}`}
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
            <p className="mt-1 font-heading text-2xl font-semibold text-primary">{openPools.length}</p>
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
            <p className="mt-1 font-heading text-2xl font-semibold text-primary">{unreadCount}</p>
          </CardContent>
        </Card>
      </div>

      {pendingOffers.length > 0 && (
        <section>
          <PageHeader title="Offers awaiting admin decision" />
          <Card className="overflow-hidden p-0">
            <div className="divide-y divide-slate-100">
              {pendingOffers.map((o) => (
                <div key={o._id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-primary">{o.name}</p>
                    <p className="text-xs text-slate-400">Submitted {formatDate(o.createdAt)}</p>
                  </div>
                  <StatusBadge status={o.status} domain="offer" />
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
              <PoolCard key={pool._id} pool={pool} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
