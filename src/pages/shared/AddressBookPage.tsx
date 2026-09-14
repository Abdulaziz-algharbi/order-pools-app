import { useState } from "react";
import { useFetch } from "@/hooks/useFetch";
import { createAddress, deleteAddress, listMyAddresses, updateAddress } from "@/services/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { AddressFields, emptyAddressFields, type AddressFieldsValue } from "@/components/domain/AddressFields";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Spinner";
import { MapPinIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { ApiError } from "@/lib/http";
import type { Address } from "@/types/domain";

function toFields(a: Address): AddressFieldsValue {
  return { location: a.location, region: a.region, city: a.city, street: a.street ?? "" };
}

// Shared by both retailer and supplier panels — addresses aren't
// role-specific (see address.model.ts), and the backend already scopes
// GET/PATCH/DELETE /addresses to the caller's own.
export function AddressBookPage() {
  const { data: addresses, isLoading, error, refetch } = useFetch(() => listMyAddresses(), []);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Address | null>(null);
  const [fields, setFields] = useState<AddressFieldsValue>(emptyAddressFields);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Address | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setEditTarget(null);
    setFields(emptyAddressFields);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (a: Address) => {
    setEditTarget(a);
    setFields(toFields(a));
    setFormError(null);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!fields.location.trim() || !fields.region.trim() || !fields.city.trim()) {
      setFormError("Map link, region, and city are required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    const input = {
      location: fields.location.trim(),
      region: fields.region.trim(),
      city: fields.city.trim(),
      street: fields.street.trim() || undefined,
    };
    try {
      if (editTarget) {
        await updateAddress(editTarget._id, input);
      } else {
        await createAddress(input);
      }
      setFormOpen(false);
      refetch();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Could not save address.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAddress(deleteTarget._id);
      setDeleteTarget(null);
      refetch();
    } catch {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Addresses"
        description="Delivery addresses saved on your account."
        action={
          <Button onClick={openCreate}>
            <PlusIcon className="h-4 w-4" /> Add address
          </Button>
        }
      />

      {error ? (
        <ErrorState onRetry={refetch} />
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (addresses ?? []).length === 0 ? (
        <EmptyState
          icon={<MapPinIcon className="h-8 w-8" />}
          title="No addresses yet"
          description="Add a delivery address to use when you join a pool."
        />
      ) : (
        <div className="space-y-3">
          {addresses!.map((a) => (
            <Card key={a._id}>
              <CardContent className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-primary">
                    {[a.street, a.city, a.region].filter(Boolean).join(", ")}
                  </p>
                  <a
                    href={a.location}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-sm text-tertiary hover:underline"
                  >
                    View on map
                  </a>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(a)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(a)} aria-label="Delete address">
                    <TrashIcon className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title={editTarget ? "Edit address" : "Add address"}
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} isLoading={saving}>
              Save
            </Button>
          </>
        }
      >
        <AddressFields value={fields} onChange={setFields} />
        {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete this address?"
        description="This cannot be undone."
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleting}>
              Delete
            </Button>
          </>
        }
      />
    </div>
  );
}
