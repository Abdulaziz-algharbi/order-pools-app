import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useFetch } from "@/hooks/useFetch";
import { createAddress, getPool, joinPool, listMyAddresses } from "@/services/api";
import { AddressFields, emptyAddressFields } from "@/components/domain/AddressFields";
import { PoolOverview } from "@/components/domain/PoolOverview";
import { EmailVerificationRequired } from "@/components/domain/EmailVerification";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FieldWrapper, Select } from "@/components/ui/Field";
import { LotPicker } from "@/components/domain/LotPicker";
import { PageSpinner, Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatNumber } from "@/lib/utils";
import { allowedJoinQuantities } from "@/lib/pool-pricing";
import { ApiError } from "@/lib/http";
import type { Address } from "@/types/domain";

export function PoolDetailPage() {
  const { poolId } = useParams<{ poolId: string }>();
  const { user } = useAuth();

  const { data: pool, isLoading, error, refetch } = useFetch(() => getPool(poolId!), [poolId]);

  const [joinOpen, setJoinOpen] = useState(false);
  // Chosen with the LotPicker: always a size the pool accepts, or null.
  const [quantity, setQuantity] = useState<number | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [newAddress, setNewAddress] = useState(emptyAddressFields);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  if (isLoading) return <PageSpinner label="Loading pool details…" />;
  if (error || !pool)
    return <ErrorState title="Pool not found" description="This pool may no longer be available." onRetry={refetch} />;

  // Exactly the sizes the backend accepts (pool-pricing.ts mirrors its rule).
  const sizes = allowedJoinQuantities(pool);

  const openJoinModal = () => {
    setQuantity(null);
    setFormError(null);
    setJoinOpen(true);
    setAddressesLoading(true);
    listMyAddresses()
      .then((list) => {
        setAddresses(list);
        setSelectedAddressId(list[0]?._id ?? "");
      })
      .finally(() => setAddressesLoading(false));
  };

  const handleJoin = async () => {
    if (sizes.length === 0) {
      setFormError("Nothing is free to join in this pool right now.");
      return;
    }
    // The picker only yields allowed sizes; null means the typed number of
    // lots isn't one (its field says so).
    if (quantity === null || !sizes.includes(quantity)) return;
    const qty = quantity;

    setSubmitting(true);
    setFormError(null);
    try {
      let addressId = selectedAddressId;
      if (!addressId) {
        if (!newAddress.location.trim() || !newAddress.region.trim() || !newAddress.city.trim()) {
          setFormError("Add a delivery address to continue.");
          setSubmitting(false);
          return;
        }
        const created = await createAddress({
          location: newAddress.location.trim(),
          region: newAddress.region.trim(),
          city: newAddress.city.trim(),
          street: newAddress.street.trim() || undefined,
        });
        addressId = created._id;
      }

      const result = await joinPool({ pool_ref: pool._id, address_ref: addressId, quantity: qty });
      setRedirecting(true);
      window.location.assign(result.checkoutUrl);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Could not join this pool.");
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/retailer/pools" className="mb-4 inline-block text-sm font-medium text-tertiary hover:underline">
        &larr; Back to pools
      </Link>

      <PoolOverview pool={pool}>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-sm font-medium text-primary">What happens after the pool is met?</p>
          <p className="text-sm text-slate-500">
            Once the target quantity is reached, the supplier prepares the order and an administrator assigns a
            delivery. You'll be notified at every step and can track delivery progress from{" "}
            <Link to="/retailer/track" className="text-tertiary hover:underline">
              Track Deliveries
            </Link>
            .
          </p>
        </div>

        {pool.status === "OPEN" && (
          <div className="space-y-2">
            <Button size="lg" className="w-full sm:w-auto" onClick={openJoinModal} disabled={!user?.isVerified}>
              Join this pool
            </Button>
            {!user?.isVerified && <EmailVerificationRequired action="join a pool" />}
          </div>
        )}
      </PoolOverview>

      <Modal
        open={joinOpen}
        onClose={() => !submitting && !redirecting && setJoinOpen(false)}
        title="Join this pool"
        description={`Retailers join in lots of ${formatNumber(pool.minimumContribution)} ${pool.unit.toLowerCase()}.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setJoinOpen(false)} disabled={submitting || redirecting}>
              Cancel
            </Button>
            <Button
              onClick={handleJoin}
              isLoading={submitting || redirecting}
              disabled={sizes.length === 0 || quantity === null}
            >
              {redirecting ? "Redirecting to payment…" : "Continue to payment"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {sizes.length === 0 ? (
            <p className="text-sm text-slate-600">Nothing is free to join in this pool right now.</p>
          ) : (
            <LotPicker pool={pool} onChange={setQuantity} />
          )}

          <FieldWrapper label="Delivery address" htmlFor="join-address" required>
            {addressesLoading ? (
              <Spinner className="h-5 w-5" />
            ) : addresses.length > 0 ? (
              <Select
                id="join-address"
                value={selectedAddressId}
                onChange={(e) => setSelectedAddressId(e.target.value)}
              >
                {addresses.map((a) => (
                  <option key={a._id} value={a._id}>
                    {[a.street, a.city, a.region].filter(Boolean).join(", ")}
                  </option>
                ))}
              </Select>
            ) : (
              <div className="rounded-lg border border-slate-200 p-3">
                <AddressFields
                  value={newAddress}
                  onChange={setNewAddress}
                  hint="You don't have a saved address yet — add one to continue."
                />
              </div>
            )}
          </FieldWrapper>

          {formError && (
            <p role="alert" className="text-sm text-red-600">
              {formError}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
