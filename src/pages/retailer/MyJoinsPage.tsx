import { useNavigate } from "react-router-dom";
import { useFetch } from "@/hooks/useFetch";
import { listMyParticipants, listPools } from "@/mocks/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ErrorState } from "@/components/ui/ErrorState";
import { LinkButton } from "@/components/ui/LinkButton";
import { formatCurrency, formatDate, formatNumber, poolProgress } from "@/lib/utils";
import type { Pool, PoolParticipant } from "@/types/domain";

interface JoinRow {
  participant: PoolParticipant;
  pool: Pool;
}

export function MyJoinsPage() {
  const navigate = useNavigate();

  const {
    data: participants,
    isLoading: participantsLoading,
    error,
    refetch,
  } = useFetch(() => listMyParticipants(), []);
  const { data: pools, isLoading: poolsLoading } = useFetch(() => listPools(), []);

  const isLoading = participantsLoading || poolsLoading;
  const rows: JoinRow[] = (participants ?? [])
    .map((participant) => {
      const pool = (pools ?? []).find((p) => p._id === participant.pool_ref);
      return pool ? { participant, pool } : null;
    })
    .filter((r): r is JoinRow => r !== null)
    .sort((a, b) => new Date(b.participant.createdAt).getTime() - new Date(a.participant.createdAt).getTime());

  const columns: Column<JoinRow>[] = [
    {
      key: "product",
      header: "Product",
      render: (r) => (
        <div>
          <p className="font-medium text-primary">{r.pool.productName}</p>
          <p className="text-xs text-slate-400">{r.pool.supplierName}</p>
        </div>
      ),
      hideOnMobileCard: true,
    },
    {
      key: "contribution",
      header: "My contribution",
      render: (r) => `${formatNumber(r.participant.quantity)} ${r.pool.unit.toLowerCase()}`,
    },
    { key: "total", header: "Total", render: (r) => formatCurrency(r.participant.quantity * r.pool.pricePerUnit) },
    {
      key: "progress",
      header: "Pool progress",
      render: (r) => (
        <div className="w-32">
          <ProgressBar value={poolProgress(r.pool.targetQuantity - r.pool.currentQuantity, r.pool.targetQuantity)} />
        </div>
      ),
    },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.participant.status} domain="participant" /> },
    { key: "joined", header: "Joined", render: (r) => formatDate(r.participant.createdAt) },
  ];

  return (
    <div>
      <PageHeader
        title="My Joins"
        description="Pools you're currently participating in."
        action={<LinkButton to="/retailer/pools" variant="outline" size="sm">Browse pools</LinkButton>}
      />

      {error ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(r) => r.participant._id}
          isLoading={isLoading}
          emptyTitle="You haven't joined any pools yet"
          emptyDescription="Browse active pools and join one to start saving on wholesale prices."
          onRowClick={(r) => navigate(`/retailer/pools/${r.pool._id}`)}
          renderMobileTitle={(r) => r.pool.productName}
        />
      )}
    </div>
  );
}
