import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useFetch } from "@/hooks/useFetch";
import { LINKED_ITEM_CLASS, linkedItemAttrs, useLinkedItem } from "@/hooks/useLinkedItem";
import { LinkedItemNotice } from "@/components/domain/LinkedItemNotice";
import { approveOffer, getUserById, listOffers, reviewOffer } from "@/services/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { ImageGallery } from "@/components/domain/ImageGallery";
import { Card, CardContent } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FieldWrapper, Input, Textarea } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Spinner";
import { ListIcon } from "@/components/ui/icons";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import { cldUrl } from "@/lib/cloudinary";
import { ApiError, apiErrorMessage } from "@/lib/http";
import { checkApproveTerms, formatOmrAmount } from "@/lib/pool-pricing";
import type { ProductOffer, ProductOfferStatus } from "@/types/domain";

type OfferDecision = Extract<ProductOfferStatus, "APPROVED" | "NEGOTIATION" | "REJECTED">;

type TermsField = "minimumContribution" | "minimumContributionPrice";

const REQUIRED: Record<TermsField, string> = {
  minimumContribution: "Enter the minimum contribution.",
  minimumContributionPrice: "Enter the minimum contribution price.",
};

// A backend 400 on one of the terms (e.g. the break-even check), keyed by
// field, so it's shown where the admin typed it.
function termsErrorsFrom(error: unknown): Partial<Record<TermsField, string>> | null {
  if (!(error instanceof ApiError) || !error.errors || typeof error.errors !== "object") return null;
  const errors = error.errors as Record<string, unknown>;
  const found: Partial<Record<TermsField, string>> = {};
  for (const field of ["minimumContribution", "minimumContributionPrice"] as const) {
    const messages = errors[field];
    if (Array.isArray(messages) && typeof messages[0] === "string") found[field] = messages[0];
  }
  return Object.keys(found).length > 0 ? found : null;
}

export function AdminOffersPage() {
  const { data: offers, isLoading, error, refetch } = useFetch(
    () => listOffers({ status: ["PENDING", "NEGOTIATION"] }),
    [],
  );
  const [supplierNames, setSupplierNames] = useState<Map<string, string>>(new Map());
  // A notification's ?offer=: the offer to review.
  const linked = useLinkedItem("offer", isLoading || error ? null : (offers ?? []).map((o) => o._id));

  useEffect(() => {
    if (!offers || offers.length === 0) return;
    const uniqueIds = [...new Set(offers.map((o) => o.user_ref))];
    Promise.all(uniqueIds.map((id) => getUserById(id).catch(() => null))).then((users) => {
      setSupplierNames(
        new Map(users.filter((u): u is NonNullable<typeof u> => !!u).map((u) => [u._id, u.companyName])),
      );
    });
  }, [offers]);

  const [activeOffer, setActiveOffer] = useState<ProductOffer | null>(null);
  const [decision, setDecision] = useState<OfferDecision | null>(null);
  const [note, setNote] = useState("");
  const [poolForm, setPoolForm] = useState({ minimumContribution: "", minimumContributionPrice: "", endDate: "" });
  // Live check of the pool's terms against the offer (break-even, the
  // payment provider's minimum, the leftover), as the admin types.
  const termsCheck = activeOffer
    ? checkApproveTerms(activeOffer, poolForm.minimumContribution, poolForm.minimumContributionPrice)
    : null;
  // "Required" only shows once the admin has tried to submit.
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Partial<Record<TermsField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const openDecision = (offer: ProductOffer, d: OfferDecision) => {
    setActiveOffer(offer);
    setDecision(d);
    setNote("");
    setFormError(null);
    setAttempted(false);
    setServerErrors({});
    // Both terms start empty: nothing is filled in for the admin.
    setPoolForm({ minimumContribution: "", minimumContributionPrice: "", endDate: "" });
  };

  const setTerm = (field: TermsField, value: string) => {
    setPoolForm((f) => ({ ...f, [field]: value }));
    setServerErrors((errors) => ({ ...errors, [field]: undefined }));
  };

  const fieldError = (field: TermsField): string | undefined =>
    serverErrors[field] ??
    termsCheck?.[field].error ??
    (attempted && poolForm[field].trim() === "" ? REQUIRED[field] : undefined);

  const close = () => {
    setActiveOffer(null);
    setDecision(null);
  };

  const confirm = async () => {
    if (!activeOffer || !decision) return;
    if (decision !== "APPROVED" && !note.trim()) {
      setFormError("A note is required.");
      return;
    }

    let endDateIso = "";
    const terms = termsCheck?.terms;
    if (decision === "APPROVED") {
      setAttempted(true);
      // The same rules the backend applies, shown under the fields.
      if (!terms) {
        setFormError(null);
        return;
      }
      if (!poolForm.endDate || new Date(poolForm.endDate).getTime() <= Date.now()) {
        setFormError("Pool deadline must be in the future.");
        return;
      }
      endDateIso = new Date(poolForm.endDate).toISOString();
    }

    setFormError(null);
    setSubmitting(true);
    try {
      const adminComment = note.trim() || undefined;
      if (decision === "APPROVED") {
        // One request: the offer is approved only if its pool is created.
        // Checked above: an approval never gets here without both terms.
        await approveOffer(activeOffer._id, {
          minimumContribution: terms!.minimumContribution,
          minimumContributionPrice: terms!.minimumContributionPrice,
          endDate: endDateIso,
          adminComment,
        });
      } else {
        await reviewOffer(activeOffer._id, { status: decision, adminComment });
      }
      close();
      refetch();
    } catch (e) {
      const onFields = decision === "APPROVED" ? termsErrorsFrom(e) : null;
      if (onFields) setServerErrors(onFields);
      else setFormError(apiErrorMessage(e, "Could not process this decision."));
    } finally {
      setSubmitting(false);
    }
  };

  const decisionCopy: Record<OfferDecision, { title: string; description: string; confirmLabel: string }> = {
    APPROVED: {
      title: "Accept this offer?",
      description: "Set the pool's terms — retailers will be able to join immediately once created.",
      confirmLabel: "Accept & create pool",
    },
    NEGOTIATION: {
      title: "Request negotiation",
      description: "Explain what needs to change before this offer can be accepted.",
      confirmLabel: "Send for negotiation",
    },
    REJECTED: {
      title: "Reject this offer?",
      description: "Explain why this offer is being rejected.",
      confirmLabel: "Reject offer",
    },
  };

  return (
    <div>
      <PageHeader title="Supplier Offers" description="Review new wholesale offers awaiting a decision." />

      {linked.notFound && (
        <LinkedItemNotice>
          This offer isn't awaiting review any more — another admin may have already decided on it. See{" "}
          <Link to="/admin/offers-history" className="font-medium text-tertiary hover:underline">
            Offers History
          </Link>
          .
        </LinkedItemNotice>
      )}

      {error ? (
        <ErrorState onRetry={refetch} />
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : (offers ?? []).length === 0 ? (
        <EmptyState icon={<ListIcon className="h-8 w-8" />} title="No offers awaiting review" description="You're all caught up." />
      ) : (
        <div className="space-y-4">
          {offers!.map((o) => (
            <Card
              key={o._id}
              {...linkedItemAttrs(linked.isLinked(o._id))}
              className={cn(linked.isLinked(o._id) && LINKED_ITEM_CLASS)}
            >
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      {supplierNames.get(o.user_ref) ?? "…"}
                    </p>
                    <h3 className="mt-0.5 font-heading text-base font-semibold text-primary">{o.name}</h3>
                  </div>
                  <StatusBadge status={o.status} domain="offer" />
                </div>
                <p className="text-sm text-slate-600">{o.description}</p>
                {/* Small previews here; the decision dialog shows them full size. */}
                {o.images?.length > 0 ? (
                  <ul className="flex gap-2 overflow-x-auto pb-1" aria-label={`${o.name} images`}>
                    {o.images.map((image, i) => (
                      <li key={image.publicId} className="relative shrink-0">
                        <img
                          src={cldUrl(image, "thumb")}
                          alt={`${o.name}, image ${i + 1} of ${o.images.length}`}
                          loading="lazy"
                          className="h-16 w-16 rounded-lg object-cover"
                        />
                        {i === 0 && (
                          <span className="absolute bottom-1 left-1 rounded bg-primary/80 px-1 text-[10px] font-medium text-white">
                            Cover
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400">No images</p>
                )}
                <dl className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-slate-400">Quantity</dt>
                    <dd className="font-medium text-primary">{formatNumber(o.wholeQuantity)} {o.unit.toLowerCase()}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Total price</dt>
                    <dd className="font-medium text-primary">{formatOmrAmount(o.totalWholesalePrice)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Submitted</dt>
                    <dd className="font-medium text-primary">{formatDate(o.createdAt)}</dd>
                  </div>
                </dl>
                {o.adminComment && (
                  <div className="rounded-lg border border-tertiary/20 bg-tertiary/5 p-3 text-sm text-slate-600">
                    <span className="font-medium text-primary">Previous note: </span>
                    {o.adminComment}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => openDecision(o, "APPROVED")}>
                    Accept
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openDecision(o, "NEGOTIATION")}>
                    Request negotiation
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => openDecision(o, "REJECTED")}>
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!activeOffer && !!decision}
        onClose={close}
        title={decision ? decisionCopy[decision].title : ""}
        description={decision ? decisionCopy[decision].description : ""}
        footer={
          <>
            <Button variant="outline" onClick={close} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant={decision === "REJECTED" ? "danger" : "primary"}
              onClick={confirm}
              isLoading={submitting}
            >
              {decision ? decisionCopy[decision].confirmLabel : "Confirm"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {activeOffer && activeOffer.images?.length > 0 && (
            <ImageGallery images={activeOffer.images} name={activeOffer.name} />
          )}
          {decision === "APPROVED" && activeOffer && (
            <>
              <p className="text-sm text-slate-600">
                The supplier asks {formatOmrAmount(activeOffer.totalWholesalePrice)} for{" "}
                {formatNumber(activeOffer.wholeQuantity)} {activeOffer.unit.toLowerCase()}. Retailers join in lots;
                selling every lot at your price must cover that.
              </p>
              <FieldWrapper
                label="Minimum contribution (units per lot)"
                htmlFor="minimumContribution"
                required
                error={fieldError("minimumContribution")}
                hint={termsCheck?.minimumContribution.hint}
              >
                <Input
                  id="minimumContribution"
                  type="number"
                  min={1}
                  step={1}
                  max={activeOffer.wholeQuantity}
                  value={poolForm.minimumContribution}
                  hasError={!!fieldError("minimumContribution")}
                  onChange={(e) => setTerm("minimumContribution", e.target.value)}
                />
              </FieldWrapper>
              <FieldWrapper
                label="Minimum contribution price (OMR per lot)"
                htmlFor="minimumContributionPrice"
                required
                error={fieldError("minimumContributionPrice")}
                hint={termsCheck?.minimumContributionPrice.hint}
              >
                <Input
                  id="minimumContributionPrice"
                  type="number"
                  min={0.1}
                  step="0.001"
                  placeholder={termsCheck?.pricePlaceholder}
                  value={poolForm.minimumContributionPrice}
                  hasError={!!fieldError("minimumContributionPrice")}
                  onChange={(e) => setTerm("minimumContributionPrice", e.target.value)}
                />
              </FieldWrapper>
              <FieldWrapper label="Pool deadline" htmlFor="endDate" required>
                <Input
                  id="endDate"
                  type="date"
                  value={poolForm.endDate}
                  onChange={(e) => setPoolForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </FieldWrapper>
            </>
          )}
          {decision !== "APPROVED" && (
            <FieldWrapper label="Note to supplier" htmlFor="admin-note" required>
              <Textarea id="admin-note" rows={4} value={note} onChange={(e) => setNote(e.target.value)} />
            </FieldWrapper>
          )}
          {formError && <p className="text-sm text-red-600">{formError}</p>}
        </div>
      </Modal>
    </div>
  );
}
