import { useFetch } from "@/hooks/useFetch";
import { listPools } from "@/mocks/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { PoolCard } from "@/components/domain/PoolCard";
import { LinkButton } from "@/components/ui/LinkButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Spinner";
import { PackageIcon } from "@/components/ui/icons";

export function SupplierPoolsPage() {
  const { data: pools, isLoading, error, refetch } = useFetch(() => listPools({ status: "OPEN" }), []);

  return (
    <div>
      <PageHeader title="Active Pools" description="Pools currently accepting retailer contributions for your products." />

      {error ? (
        <ErrorState onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : (pools ?? []).length === 0 ? (
        <EmptyState
          icon={<PackageIcon className="h-8 w-8" />}
          title="No active pools"
          description="Submit an offer to start a new pool for your product."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pools!.map((pool) => (
            <PoolCard
              key={pool._id}
              pool={pool}
              action={
                <LinkButton to={`/supplier/pools/${pool._id}`} variant="outline" className="w-full">
                  View details
                </LinkButton>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
