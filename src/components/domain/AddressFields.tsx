import { Input } from "@/components/ui/Field";

export interface AddressFieldsValue {
  location: string;
  region: string;
  city: string;
  street: string;
}

export const emptyAddressFields: AddressFieldsValue = {
  location: "",
  region: "",
  city: "",
  street: "",
};

interface AddressFieldsProps {
  value: AddressFieldsValue;
  onChange: (next: AddressFieldsValue) => void;
  /** Shown above the inputs — omit for a standalone form that has its own heading. */
  hint?: string;
}

// The address shape every account needs at least one of at registration
// (see AuthController.register) — shared by SignupPage and PoolDetailPage's
// inline "add an address to join" fallback, so the two never drift apart.
export function AddressFields({ value, onChange, hint }: AddressFieldsProps) {
  return (
    <div className="space-y-2">
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      <Input
        placeholder="Map link (location URL)"
        value={value.location}
        onChange={(e) => onChange({ ...value, location: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder="City"
          value={value.city}
          onChange={(e) => onChange({ ...value, city: e.target.value })}
        />
        <Input
          placeholder="Region"
          value={value.region}
          onChange={(e) => onChange({ ...value, region: e.target.value })}
        />
      </div>
      <Input
        placeholder="Street (optional)"
        value={value.street}
        onChange={(e) => onChange({ ...value, street: e.target.value })}
      />
    </div>
  );
}
