import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProfileCard } from "@/components/domain/ProfileCard";
import { formatDate } from "@/lib/utils";
import type { RetailerUser } from "@/types/domain";

export function RetailerProfilePage() {
  const { user } = useAuth();
  const retailer = user as RetailerUser;

  return (
    <div>
      <PageHeader title="Profile" description="Your account and business information." />
      <ProfileCard
        name={retailer.businessName}
        subtitle={retailer.name}
        email={retailer.email}
        fields={[
          { label: "Phone", value: retailer.phone ?? "—" },
          { label: "Address", value: retailer.address ?? "—" },
          { label: "Member since", value: formatDate(retailer.createdAt) },
          { label: "Role", value: "Retailer" },
        ]}
      />
    </div>
  );
}
