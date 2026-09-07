import { useFetch } from "@/hooks/useFetch";
import { listRetailers } from "@/mocks/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatDate } from "@/lib/utils";
import type { AppUser } from "@/types/domain";

export function AdminRetailersPage() {
  const { data: retailers, isLoading, error, refetch } = useFetch(() => listRetailers(), []);

  const columns: Column<AppUser>[] = [
    {
      key: "business",
      header: "Business",
      render: (r) => (
        <div>
          <p className="font-medium text-primary">{r.companyName}</p>
          <p className="text-xs text-slate-400">{r.firstName} {r.lastName}</p>
        </div>
      ),
    },
    { key: "email", header: "Email", render: (r) => r.email },
    { key: "phone", header: "Phone", render: (r) => r.phoneNumber || "—" },
    { key: "since", header: "Member since", render: (r) => formatDate(r.createdAt) },
  ];

  return (
    <div>
      <PageHeader title="Retailers" description="All retailers registered on the platform." />
      {error ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={retailers ?? []}
          rowKey={(r) => r._id}
          isLoading={isLoading}
          emptyTitle="No retailers yet"
          renderMobileTitle={(r) => r.companyName}
        />
      )}
    </div>
  );
}
