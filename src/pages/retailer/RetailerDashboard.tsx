import { useAuth } from "@/context/AuthContext";
import { useFetch } from "@/hooks/useFetch";
import { listJoinsByRetailer, listPools } from "@/mocks/api";
import { useNotifications } from "@/hooks/useNotifications";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { PoolCard } from "@/components/domain/PoolCard";
import { NotificationItem } from "@/components/domain/NotificationItem";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Spinner";
import { LinkButton } from "@/components/ui/LinkButton";
import { PackageIcon } from "@/components/ui/icons";
import { poolProgress } from "@/lib/utils";
import type { RetailerUser } from "@/types/domain";

export function RetailerDashboard() {
  const { user } = useAuth();
  const retailer = user as RetailerUser;

  const { data: joins } = useFetch(() => listJoinsByRetailer(retailer.id), [retailer.id]);
  const {
    data: pools,
    isLoading: poolsLoading,
    error: poolsError,
    refetch,
  } = useFetch(() => listPools({ status: "active" }), []);
  const { notifications } = useNotifications(retailer.id);

  const activeJoinCount = joins?.length ?? 0;
  const closingSoon = (pools ?? [])
    .filter((p) => poolProgress(p.currentQuantity, p.targetQuantity) >= 60)
    .slice(0, 3);

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back, ${retailer.businessName}`}
        description="Here's what needs your attention today."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Pools joined</p>
            <p className="mt-1 font-heading text-2xl font-semibold text-primary">{activeJoinCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Active pools available</p>
            <p className="mt-1 font-heading text-2xl font-semibold text-primary">{pools?.length ?? "—"}</p>
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

      <section>
        <PageHeader
          title="Pools close to their target"
          description="Join now before these fill up."
          action={
            <LinkButton to="/retailer/pools" variant="outline" size="sm">
              Browse all pools
            </LinkButton>
          }
        />
        {poolsError ? (
          <ErrorState onRetry={refetch} />
        ) : poolsLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        ) : closingSoon.length === 0 ? (
          <EmptyState
            icon={<PackageIcon className="h-8 w-8" />}
            title="No pools close to their target yet"
            description="Check back soon or browse all active pools."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {closingSoon.map((pool) => (
              <PoolCard
                key={pool.id}
                pool={pool}
                action={
                  <LinkButton to={`/retailer/pools/${pool.id}`} className="w-full">
                    View & Join
                  </LinkButton>
                }
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <PageHeader title="Recent notifications" />
        <Card className="overflow-hidden p-0">
          {notifications.length === 0 ? (
            <EmptyState title="No notifications yet" className="border-0" />
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.slice(0, 5).map((n) => (
                <NotificationItem key={n.id} notification={n} />
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
