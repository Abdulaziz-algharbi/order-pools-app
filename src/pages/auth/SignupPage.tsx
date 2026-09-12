import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { defaultPanelFor } from "@/lib/panel";
import { ApiError } from "@/lib/http";
import { createUnlinkedAddress } from "@/mocks/api";
import { Button } from "@/components/ui/Button";
import { FieldWrapper, Input } from "@/components/ui/Field";
import { AddressFields, emptyAddressFields, type AddressFieldsValue } from "@/components/domain/AddressFields";

interface AccountFields {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  companyName: string;
  password: string;
}

const emptyAccountFields: AccountFields = {
  firstName: "",
  lastName: "",
  email: "",
  phoneNumber: "",
  companyName: "",
  password: "",
};

// Every account starts RETAILER-only — becoming a SUPPLIER is a separate,
// admin-approved request made after signing in (see AdminSuppliersPage /
// createSupplierRequest), never a choice made at signup time.
export function SignupPage() {
  const { user, signup, isLoading } = useAuth();
  const [account, setAccount] = useState<AccountFields>(emptyAccountFields);
  const [address, setAddress] = useState<AddressFieldsValue>(emptyAddressFields);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isLoading && user) {
    const panel = defaultPanelFor(user);
    return <Navigate to={panel ? `/${panel}` : "/login"} replace />;
  }

  const update = (field: keyof AccountFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setAccount((a) => ({ ...a, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (
      !account.firstName.trim() ||
      !account.lastName.trim() ||
      !account.email.trim() ||
      !account.phoneNumber.trim() ||
      !account.companyName.trim() ||
      !account.password ||
      !address.location.trim() ||
      !address.region.trim() ||
      !address.city.trim()
    ) {
      setError("Please fill in every required field.");
      return;
    }

    setIsSubmitting(true);
    try {
      const createdAddress = await createUnlinkedAddress({
        location: address.location.trim(),
        region: address.region.trim(),
        city: address.city.trim(),
        street: address.street.trim() || undefined,
      });
      await signup({
        firstName: account.firstName.trim(),
        lastName: account.lastName.trim(),
        email: account.email.trim(),
        phoneNumber: account.phoneNumber.trim(),
        companyName: account.companyName.trim(),
        password: account.password,
        addresses: [createdAddress._id],
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create your account. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-primary px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-lg font-bold text-white">
            OP
          </div>
          <h1 className="font-heading text-2xl font-semibold text-white">Order Pool</h1>
          <p className="mt-1 text-sm text-slate-400">Wholesale group purchasing, made accessible.</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-xl sm:p-8">
          <h2 className="font-heading text-lg font-semibold text-primary">Create your account</h2>
          <p className="mt-1 text-sm text-slate-500">Every new account starts as a retailer.</p>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <FieldWrapper label="First name" htmlFor="su-firstName" required>
                <Input id="su-firstName" value={account.firstName} onChange={update("firstName")} />
              </FieldWrapper>
              <FieldWrapper label="Last name" htmlFor="su-lastName" required>
                <Input id="su-lastName" value={account.lastName} onChange={update("lastName")} />
              </FieldWrapper>
            </div>
            <FieldWrapper label="Company name" htmlFor="su-company" required>
              <Input id="su-company" value={account.companyName} onChange={update("companyName")} />
            </FieldWrapper>
            <FieldWrapper label="Email" htmlFor="su-email" required>
              <Input id="su-email" type="email" autoComplete="email" value={account.email} onChange={update("email")} />
            </FieldWrapper>
            <div className="grid grid-cols-2 gap-4">
              <FieldWrapper label="Phone" htmlFor="su-phone" required>
                <Input id="su-phone" value={account.phoneNumber} onChange={update("phoneNumber")} />
              </FieldWrapper>
              <FieldWrapper label="Password" htmlFor="su-password" required>
                <Input
                  id="su-password"
                  type="password"
                  autoComplete="new-password"
                  value={account.password}
                  onChange={update("password")}
                />
              </FieldWrapper>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <p className="mb-2 text-sm font-medium text-primary">
                Delivery address<span className="text-red-500"> *</span>
              </p>
              <AddressFields value={address} onChange={setAddress} />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" isLoading={isSubmitting}>
              Create account
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-tertiary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
