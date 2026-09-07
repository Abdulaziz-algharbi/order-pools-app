import { useState } from "react";
import { useFetch } from "@/hooks/useFetch";
import { listPools } from "@/mocks/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { PoolCard } from "@/components/domain/PoolCard";
import { LinkButton } from "@/components/ui/LinkButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Spinner";
import { Input } from "@/components/ui/Field";
import { SearchIcon, PackageIcon } from "@/components/ui/icons";

export function PoolsBrowsePage() {
  const [search, setSearch] = useState("");
  const { data: pools, isLoading, error, refetch } = useFetch(() => listPools({ status: "OPEN" }), []);

  const filtered = (pools ?? []).filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.productName.toLowerCase().includes(q) || (p.supplierName ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <PageHeader
        title="Browse Pools"
        description="Join a wholesale pool with other retailers to unlock better prices."
      />

      <div className="relative mb-6 max-w-sm">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search by product or supplier"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {error ? (
        <ErrorState onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<PackageIcon className="h-8 w-8" />}
          title="No pools found"
          description={search ? "Try a different search term." : "There are no active pools right now — check back soon."}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((pool) => (
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
    </div>
  );
}
