import { Link, useParams } from "react-router-dom";
import { useFetch } from "@/hooks/useFetch";
import { getPool } from "@/mocks/api";
import { PoolOverview } from "@/components/domain/PoolOverview";
import { PageSpinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/ErrorState";

export function SupplierPoolDetailPage() {
  const { poolId } = useParams<{ poolId: string }>();
  const { data: pool, isLoading, error, refetch } = useFetch(() => getPool(poolId!), [poolId]);

  if (isLoading) return <PageSpinner label="Loading pool details…" />;
  if (error || !pool) return <ErrorState title="Pool not found" onRetry={refetch} />;

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/supplier/pools" className="mb-4 inline-block text-sm font-medium text-tertiary hover:underline">
        &larr; Back to active pools
      </Link>
      {/* Suppliers can't see who joined their pool (the backend only exposes
          participant identities to the admin and the retailer themselves) —
          just the aggregate participantCount shown inside PoolOverview. */}
      <PoolOverview pool={pool} />
    </div>
  );
}
