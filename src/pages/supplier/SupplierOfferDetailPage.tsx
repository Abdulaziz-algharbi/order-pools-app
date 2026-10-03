import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useFetch } from "@/hooks/useFetch";
import { deleteOffer, getOffer, updateOwnOffer } from "@/services/api";
import { ImageGallery } from "@/components/domain/ImageGallery";
import { ImageUploader } from "@/components/domain/ImageUploader";
import { Card, CardContent } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageSpinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FieldWrapper, Input, Select, Textarea } from "@/components/ui/Field";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { ApiError } from "@/lib/http";
import { MAX_OFFER_IMAGES } from "@/lib/cloudinary";
import type { ImageRef, ProductOfferUnit } from "@/types/domain";

// The backend lets the owner edit only a PENDING/NEGOTIATION offer (409
// otherwise): once APPROVED its pool holds a copy of these fields. It
// still allows withdrawing at any status, but that only makes sense before
// a decision too — REJECTED offers auto-delete 7 days later on their own
// (see product.offer.model.ts's TTL index).
const EDITABLE_STATUSES = ["PENDING", "NEGOTIATION"];

interface EditForm {
  name: string;
  description: string;
  brand: string;
  unit: ProductOfferUnit;
  wholeQuantity: string;
  price: string;
}

export function SupplierOfferDetailPage() {
  const { offerId } = useParams<{ offerId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: offer, isLoading, error, refetch } = useFetch(() => getOffer(offerId!), [offerId]);

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  // The offer's current images plus any new uploads, in order.
  const [images, setImages] = useState<ImageRef[]>([]);
  const [uploading, setUploading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (isLoading) return <PageSpinner label="Loading offer…" />;
  if (error || !offer) return <ErrorState title="Offer not found" onRetry={refetch} />;

  const canEdit = EDITABLE_STATUSES.includes(offer.status);

  const openEdit = () => {
    setForm({
      name: offer.name,
      description: offer.description,
      brand: offer.brand ?? "",
      unit: offer.unit,
      wholeQuantity: String(offer.wholeQuantity),
      price: String(offer.price),
    });
    setImages(offer.images ?? []);
    setEditError(null);
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!form) return;
    const wholeQuantity = Number(form.wholeQuantity);
    const price = Number(form.price);
    if (!form.name.trim() || !form.description.trim()) {
      setEditError("Name and description are required.");
      return;
    }
    if (!wholeQuantity || wholeQuantity <= 0 || !price || price <= 0) {
      setEditError("Quantity and price must be positive numbers.");
      return;
    }
    setSaving(true);
    setEditError(null);
    try {
      await updateOwnOffer(offer._id, {
        name: form.name.trim(),
        description: form.description.trim(),
        brand: form.brand.trim() || null,
        unit: form.unit,
        images,
        wholeQuantity,
        price,
      });
      setEditOpen(false);
      refetch();
    } catch (e) {
      setEditError(e instanceof ApiError ? e.message : "Could not update offer.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteOffer(offer._id);
      navigate("/supplier/offers");
    } catch {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/supplier/offers" className="mb-4 inline-block text-sm font-medium text-tertiary hover:underline">
        &larr; Back to offers
      </Link>

      <Card>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              {offer.brand && (
                <p className="text-sm font-medium uppercase tracking-wide text-slate-400">{offer.brand}</p>
              )}
              <h1 className="mt-1 font-heading text-2xl font-semibold text-primary">{offer.name}</h1>
            </div>
            <StatusBadge status={offer.status} domain="offer" />
          </div>

          {offer.images?.length > 0 && <ImageGallery images={offer.images} name={offer.name} />}

          <p className="text-slate-600">{offer.description}</p>

          <dl className="grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-slate-400">Quantity</dt>
              <dd className="font-heading text-lg font-semibold text-primary">
                {formatNumber(offer.wholeQuantity)} {offer.unit.toLowerCase()}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Price</dt>
              <dd className="font-heading text-lg font-semibold text-primary">
                {formatCurrency(offer.price)} / {offer.unit.toLowerCase()}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Submitted</dt>
              <dd className="font-heading text-lg font-semibold text-primary">{formatDate(offer.createdAt)}</dd>
            </div>
          </dl>

          {offer.adminComment && (
            <div className="rounded-lg border border-tertiary/20 bg-tertiary/5 p-4">
              <p className="text-sm font-medium text-primary">Note from admin</p>
              <p className="mt-1 text-sm text-slate-600">{offer.adminComment}</p>
            </div>
          )}

          {canEdit && (
            <div className="flex gap-2 border-t border-slate-100 pt-4">
              <Button variant="outline" onClick={openEdit}>
                Edit offer
              </Button>
              <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                Withdraw offer
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {form && (
        <Modal
          open={editOpen}
          onClose={() => !saving && setEditOpen(false)}
          title="Edit offer"
          footer={
            <>
              <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} isLoading={saving} disabled={uploading}>
                Save
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <FieldWrapper label="Name" htmlFor="edit-name" required>
              <Input id="edit-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </FieldWrapper>
            <FieldWrapper label="Brand" htmlFor="edit-brand" hint="Optional">
              <Input id="edit-brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </FieldWrapper>
            <FieldWrapper label="Description" htmlFor="edit-description" required>
              <Textarea
                id="edit-description"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </FieldWrapper>
            <FieldWrapper
              label="Product images"
              htmlFor="edit-images"
              hint={
                user?.isVerified
                  ? `Up to ${MAX_OFFER_IMAGES}. The first is the cover.`
                  : "Verify your email address to change the images."
              }
            >
              <ImageUploader
                id="edit-images"
                purpose="offer"
                max={MAX_OFFER_IMAGES}
                value={images}
                onChange={setImages}
                onUploadingChange={setUploading}
                disabled={!user?.isVerified || saving}
              />
            </FieldWrapper>
            <div className="grid grid-cols-2 gap-4">
              <FieldWrapper label="Unit" htmlFor="edit-unit">
                <Select
                  id="edit-unit"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value as ProductOfferUnit })}
                >
                  <option value="PIECE">Piece</option>
                  <option value="KG">Kg</option>
                  <option value="BOX">Box</option>
                  <option value="CARTON">Carton</option>
                </Select>
              </FieldWrapper>
              <FieldWrapper label="Whole quantity" htmlFor="edit-qty" required>
                <Input
                  id="edit-qty"
                  type="number"
                  min={1}
                  value={form.wholeQuantity}
                  onChange={(e) => setForm({ ...form, wholeQuantity: e.target.value })}
                />
              </FieldWrapper>
            </div>
            <FieldWrapper
              label="Price per unit"
              htmlFor="edit-price"
              error={editError ?? undefined}
              required
            >
              <Input
                id="edit-price"
                type="number"
                min={0}
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                hasError={!!editError}
              />
            </FieldWrapper>
          </div>
        </Modal>
      )}

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Withdraw this offer?"
        description="This removes the offer from admin review. This cannot be undone."
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleting}>
              Withdraw
            </Button>
          </>
        }
      />
    </div>
  );
}
