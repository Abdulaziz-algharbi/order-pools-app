import { useAuth } from "@/context/AuthContext";
import { useFetch } from "@/hooks/useFetch";
import { listMyParticipants, listPools } from "@/mocks/api";
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

export function RetailerDashboard() {
  const { user } = useAuth();

  const { data: participants } = useFetch(() => listMyParticipants(), []);
  const {
    data: pools,
    isLoading: poolsLoading,
    error: poolsError,
    refetch,
  } = useFetch(() => listPools({ status: "OPEN" }), []);
  const { notifications, unreadCount, isReadForUser } = useNotifications(user?._id);

  const activeJoinCount = participants?.length ?? 0;
  const closingSoon = (pools ?? [])
    .filter((p) => poolProgress(p.targetQuantity - p.currentQuantity, p.targetQuantity) >= 60)
    .slice(0, 3);

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back, ${user?.companyName ?? ""}`}
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
            <p className="mt-1 font-heading text-2xl font-semibold text-primary">{unreadCount}</p>
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
                key={pool._id}
                pool={pool}
                action={
                  <LinkButton to={`/retailer/pools/${pool._id}`} className="w-full">
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
                <NotificationItem key={n._id} notification={n} isRead={isReadForUser(n)} />
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
