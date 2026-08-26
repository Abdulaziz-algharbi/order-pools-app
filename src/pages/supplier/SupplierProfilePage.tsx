import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProfileCard } from "@/components/domain/ProfileCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/utils";
import type { SupplierUser } from "@/types/domain";

export function SupplierProfilePage() {
  const { user } = useAuth();
  const supplier = user as SupplierUser;

  return (
    <div>
      <PageHeader title="Profile" description="Your account and company information." />
      <ProfileCard
        name={supplier.companyName}
        subtitle={supplier.name}
        email={supplier.email}
        badge={<StatusBadge status={supplier.verified ? "approved" : "pending"} />}
        fields={[
          { label: "Phone", value: supplier.phone ?? "—" },
          { label: "Address", value: supplier.address ?? "—" },
          { label: "Member since", value: formatDate(supplier.createdAt) },
          { label: "Role", value: "Supplier" },
        ]}
      />
    </div>
  );
}
