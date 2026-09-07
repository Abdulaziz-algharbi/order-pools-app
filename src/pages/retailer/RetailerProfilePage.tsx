import { useAuth } from "@/context/AuthContext";
import { useFetch } from "@/hooks/useFetch";
import { listMyAddresses } from "@/mocks/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProfileCard } from "@/components/domain/ProfileCard";
import { formatDate } from "@/lib/utils";

export function RetailerProfilePage() {
  const { user } = useAuth();
  const { data: addresses } = useFetch(() => listMyAddresses(), []);

  if (!user) return null;

  return (
    <div>
      <PageHeader title="Profile" description="Your account and business information." />
      <ProfileCard
        name={user.companyName}
        subtitle={`${user.firstName} ${user.lastName}`}
        email={user.email}
        fields={[
          { label: "Phone", value: user.phoneNumber || "—" },
          {
            label: "Addresses",
            value: addresses ? `${addresses.length} saved` : "—",
          },
          { label: "Member since", value: formatDate(user.createdAt) },
          { label: "Role", value: "Retailer" },
        ]}
      />
    </div>
  );
}
