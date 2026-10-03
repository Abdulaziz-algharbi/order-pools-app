import { useAuth } from "@/context/AuthContext";
import { useFetch } from "@/hooks/useFetch";
import { listMyAddresses } from "@/services/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProfileCard } from "@/components/domain/ProfileCard";
import { ProfileActions } from "@/components/domain/ProfileActions";
import { ProfilePhoto } from "@/components/domain/ProfilePhoto";
import { SupplierAccessCard } from "@/components/domain/SupplierAccessCard";
import { PANEL_LABEL, type Panel } from "@/lib/panel";
import { formatDate } from "@/lib/utils";

const DESCRIPTION: Record<Panel, string> = {
  retailer: "Your account and business information.",
  supplier: "Your account and company information.",
  admin: "Your administrator account.",
};

/**
 * The profile page of every panel. The account is the same one whichever
 * panel it's viewed from; what differs is the panel-specific extras — the
 * address book (retailer/supplier), the "Become a supplier" card
 * (retailer, until the account holds SUPPLIER), and account closure (not
 * offered to admins: the backend would delete an admin-only account
 * outright).
 */
export function ProfilePage({ panel }: { panel: Panel }) {
  const { user } = useAuth();
  const hasAddressBook = panel !== "admin";
  const { data: addresses } = useFetch(
    () => (hasAddressBook ? listMyAddresses() : Promise.resolve([])),
    [hasAddressBook],
  );

  if (!user) return null;

  const fields = [
    { label: "Phone", value: user.phoneNumber || "—" },
    ...(hasAddressBook
      ? [{ label: "Addresses", value: addresses ? `${addresses.length} saved` : "—" }]
      : []),
    ...(panel === "supplier"
      ? [
          { label: "Commercial registration", value: user.commercialRegistration || "—" },
          { label: "VAT number", value: user.vatNumber || "—" },
        ]
      : []),
    { label: "Member since", value: formatDate(user.createdAt) },
    { label: "Role", value: PANEL_LABEL[panel] },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Profile" description={DESCRIPTION[panel]} />
      <ProfileCard
        name={user.companyName}
        subtitle={`${user.firstName} ${user.lastName}`}
        email={user.email}
        fields={fields}
        avatar={<ProfilePhoto />}
      />
      <ProfileActions
        addressesPath={hasAddressBook ? `/${panel}/addresses` : undefined}
        canRemoveAccount={panel !== "admin"}
      />
      {panel === "retailer" && !user.roles.includes("SUPPLIER") && <SupplierAccessCard />}
    </div>
  );
}
