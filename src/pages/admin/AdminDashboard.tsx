import { useAuth } from "@/context/AuthContext";
import { useFetch } from "@/hooks/useFetch";
import { listComplaints, listOffers, listPools, listSupplierRequests } from "@/mocks/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Skeleton } from "@/components/ui/Spinner";
import type { AdminUser } from "@/types/domain";

export function AdminDashboard() {
  const { user } = useAuth();
  const admin = user as AdminUser;

  const { data: offers, isLoading: offersLoading } = useFetch(
    () => listOffers({ status: ["pending_review", "negotiation"] }),
    [],
  );
  const { data: complaints, isLoading: complaintsLoading } = useFetch(
    () => listComplaints({ status: ["open", "in_review"] }),
    [],
  );
  const { data: metPools, isLoading: metLoading } = useFetch(() => listPools({ status: "met" }), []);
  const { data: requests, isLoading: requestsLoading } = useFetch(() => listSupplierRequests(), []);

  const pendingRequests = (requests ?? []).filter((r) => r.status === "pending");
  const isLoading = offersLoading || complaintsLoading || metLoading || requestsLoading;

  const attentionItems = [
    {
      label: "Supplier offers to review",
      count: offers?.length ?? 0,
      to: "/admin/offers",
      cta: "Review offers",
    },
    {
      label: "Pools met — ready for delivery assignment",
      count: metPools?.length ?? 0,
      to: "/admin/met-pools",
      cta: "Assign delivery",
    },
    {
      label: "Open complaints",
      count: complaints?.length ?? 0,
      to: "/admin/complaints",
      cta: "View complaints",
    },
    {
      label: "Supplier requests pending",
      count: pendingRequests.length,
      to: "/admin/suppliers",
      cta: "Review requests",
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title={`Welcome back, ${admin.name}`} description="Here's what requires your attention right now." />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {attentionItems.map((item) => (
            <Card key={item.label} className={item.count > 0 ? "border-tertiary/30" : undefined}>
              <CardContent className="flex h-full flex-col justify-between gap-4">
                <div>
                  <p className="font-heading text-3xl font-semibold text-primary">{item.count}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.label}</p>
                </div>
                <LinkButton to={item.to} variant="outline" size="sm" className="w-full">
                  {item.cta}
                </LinkButton>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <section>
        <PageHeader title="Recent supplier offers" />
        <Card className="overflow-hidden p-0">
          {(offers ?? []).length === 0 ? (
            <p className="p-5 text-sm text-slate-500">No offers currently awaiting review.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {offers!.slice(0, 5).map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-primary">{o.productName}</p>
                    <p className="text-xs text-slate-400">{o.supplierName}</p>
                  </div>
                  <StatusBadge status={o.status} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
