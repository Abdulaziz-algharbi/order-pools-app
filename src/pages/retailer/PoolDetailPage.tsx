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
import { FieldWrapper, Input, Select } from "@/components/ui/Field";
import { PageSpinner, Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatNumber } from "@/lib/utils";
import { allowedJoinQuantities, contributionBaisa, formatOmrAmount } from "@/lib/pool-pricing";
import { ApiError } from "@/lib/http";
import type { Address, Pool } from "@/types/domain";

// Past this many sizes, a list stops being usable (e.g. lots of 1 in a pool
// of 10,000), so the quantity is typed instead, stepping by the lot.
const MAX_LISTED_SIZES = 100;

// One join size as the retailer picks it: whole lots, or everything still
// free (which may carry the leftover), with exactly what it costs.
function sizeLabel(pool: Pool, quantity: number): string {
  const unit = pool.unit.toLowerCase();
  const total = formatOmrAmount(contributionBaisa(pool, quantity) / 1000);
  if (quantity !== pool.currentQuantity) return `${formatNumber(quantity)} ${unit} — ${total}`;
  const lots = Math.floor(quantity / pool.minimumContribution);
  const leftover = quantity % pool.minimumContribution;
  const split =
    leftover === 0 ? "" : ` (${formatNumber(lots)} ${lots === 1 ? "lot" : "lots"} + ${formatNumber(leftover)} left over)`;
  return `All ${formatNumber(quantity)} still free${split} — ${total}`;
}

// What to tell a retailer whose typed quantity isn't one the pool accepts.
function sizeAdvice(pool: Pool, sizes: number[]): string {
  const free = formatNumber(pool.currentQuantity);
  if (sizes.length <= 1) return `Only all ${free} still free can be taken now.`;
  const largestLots = sizes[sizes.length - 2];
  return `Choose a multiple of ${formatNumber(pool.minimumContribution)} up to ${formatNumber(largestLots)}, or all ${free} still free.`;
}

export function PoolDetailPage() {
  const { poolId } = useParams<{ poolId: string }>();
  const { user } = useAuth();

  const { data: pool, isLoading, error, refetch } = useFetch(() => getPool(poolId!), [poolId]);

  const [joinOpen, setJoinOpen] = useState(false);
  const [quantity, setQuantity] = useState<string>("");
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

  const remaining = pool.currentQuantity;
  // Exactly the sizes the backend accepts (pool-pricing.ts mirrors its rule).
  const sizes = allowedJoinQuantities(pool);
  const listSizes = sizes.length <= MAX_LISTED_SIZES;
  const leftover = remaining % pool.minimumContribution;

  const openJoinModal = () => {
    setQuantity(sizes.length > 0 ? String(sizes[0]) : "");
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
    const qty = Number(quantity);
    if (sizes.length === 0) {
      setFormError("Nothing is free to join in this pool right now.");
      return;
    }
    if (!sizes.includes(qty)) {
      setFormError(sizeAdvice(pool, sizes));
      return;
    }

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

  // What the backend will charge for this size — exact, from the lot price.
  const total = sizes.includes(Number(quantity)) ? contributionBaisa(pool, Number(quantity)) : null;
  const lotHint =
    `In lots of ${formatNumber(pool.minimumContribution)} · ${formatOmrAmount(pool.minimumContributionPrice)} per lot.` +
    (leftover === 0 ? "" : ` The last joiner also takes the ${formatNumber(leftover)} left over.`);

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
        description={`Choose how many ${pool.unit.toLowerCase()} you'd like to contribute.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setJoinOpen(false)} disabled={submitting || redirecting}>
              Cancel
            </Button>
            <Button onClick={handleJoin} isLoading={submitting || redirecting} disabled={sizes.length === 0}>
              {redirecting ? "Redirecting to payment…" : "Continue to payment"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FieldWrapper
            label={`Quantity (${pool.unit.toLowerCase()})`}
            htmlFor="join-quantity"
            error={formError ?? undefined}
            hint={sizes.length === 0 ? "Nothing is free to join in this pool right now." : lotHint}
            required
          >
            {listSizes ? (
              <Select
                id="join-quantity"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={sizes.length === 0}
                hasError={!!formError}
              >
                {sizes.map((size) => (
                  <option key={size} value={size}>
                    {sizeLabel(pool, size)}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                id="join-quantity"
                type="number"
                min={pool.minimumContribution}
                step={pool.minimumContribution}
                max={remaining}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                hasError={!!formError}
              />
            )}
          </FieldWrapper>

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

          {total !== null && (
            <p className="text-sm text-slate-500">
              Total: <span className="font-medium text-primary">{formatOmrAmount(total / 1000)}</span>
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
