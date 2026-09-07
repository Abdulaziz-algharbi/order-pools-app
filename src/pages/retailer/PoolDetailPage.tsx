import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useFetch } from "@/hooks/useFetch";
import { createAddress, getPool, joinPool, listMyAddresses } from "@/mocks/api";
import { PoolOverview } from "@/components/domain/PoolOverview";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FieldWrapper, Input, Select } from "@/components/ui/Field";
import { PageSpinner, Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { ApiError } from "@/lib/http";
import type { Address } from "@/types/domain";

export function PoolDetailPage() {
  const { poolId } = useParams<{ poolId: string }>();

  const { data: pool, isLoading, error, refetch } = useFetch(() => getPool(poolId!), [poolId]);

  const [joinOpen, setJoinOpen] = useState(false);
  const [quantity, setQuantity] = useState<string>("");
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [newAddress, setNewAddress] = useState({ location: "", region: "", city: "", street: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  if (isLoading) return <PageSpinner label="Loading pool details…" />;
  if (error || !pool)
    return <ErrorState title="Pool not found" description="This pool may no longer be available." onRetry={refetch} />;

  const remaining = pool.currentQuantity;

  const openJoinModal = () => {
    setQuantity(String(pool.minimumContribution));
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
    if (!qty || qty <= 0) {
      setFormError("Enter a valid quantity.");
      return;
    }
    if (qty < pool.minimumContribution) {
      setFormError(`Minimum contribution is ${formatNumber(pool.minimumContribution)} ${pool.unit.toLowerCase()}.`);
      return;
    }
    if (qty > remaining) {
      setFormError(`Only ${formatNumber(remaining)} ${pool.unit.toLowerCase()} remaining in this pool.`);
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

  const estimatedTotal = Number(quantity) > 0 ? Number(quantity) * pool.pricePerUnit : 0;

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
          <Button size="lg" className="w-full sm:w-auto" onClick={openJoinModal}>
            Join this pool
          </Button>
        )}
      </PoolOverview>

      <Modal
        open={joinOpen}
        onClose={() => !submitting && !redirecting && setJoinOpen(false)}
        title="Join this pool"
        description={`Enter how many ${pool.unit.toLowerCase()} you'd like to contribute.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setJoinOpen(false)} disabled={submitting || redirecting}>
              Cancel
            </Button>
            <Button onClick={handleJoin} isLoading={submitting || redirecting}>
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
            hint={`Min. ${formatNumber(pool.minimumContribution)} · Max. ${formatNumber(remaining)} remaining`}
            required
          >
            <Input
              id="join-quantity"
              type="number"
              min={pool.minimumContribution}
              max={remaining}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              hasError={!!formError}
            />
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
              <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">You don't have a saved address yet — add one to continue.</p>
                <Input
                  placeholder="Map link (location URL)"
                  value={newAddress.location}
                  onChange={(e) => setNewAddress((a) => ({ ...a, location: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="City"
                    value={newAddress.city}
                    onChange={(e) => setNewAddress((a) => ({ ...a, city: e.target.value }))}
                  />
                  <Input
                    placeholder="Region"
                    value={newAddress.region}
                    onChange={(e) => setNewAddress((a) => ({ ...a, region: e.target.value }))}
                  />
                </div>
                <Input
                  placeholder="Street (optional)"
                  value={newAddress.street}
                  onChange={(e) => setNewAddress((a) => ({ ...a, street: e.target.value }))}
                />
              </div>
            )}
          </FieldWrapper>

          {estimatedTotal > 0 && (
            <p className="text-sm text-slate-500">
              Estimated total: <span className="font-medium text-primary">{formatCurrency(estimatedTotal)}</span>
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
