import { useEffect, useState } from "react";
import { useFetch } from "@/hooks/useFetch";
import { createPool, getUserById, listOffers, reviewOffer } from "@/mocks/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FieldWrapper, Input, Textarea } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Spinner";
import { ListIcon } from "@/components/ui/icons";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { ApiError } from "@/lib/http";
import type { ProductOffer, ProductOfferStatus } from "@/types/domain";

type OfferDecision = Extract<ProductOfferStatus, "APPROVED" | "NEGOTIATION" | "REJECTED">;

export function AdminOffersPage() {
  const { data: offers, isLoading, error, refetch } = useFetch(
    () => listOffers({ status: ["PENDING", "NEGOTIATION"] }),
    [],
  );
  const [supplierNames, setSupplierNames] = useState<Map<string, string>>(new Map());

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
  const [poolForm, setPoolForm] = useState({ minimumContribution: "", pricePerUnit: "", endDate: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const openDecision = (offer: ProductOffer, d: OfferDecision) => {
    setActiveOffer(offer);
    setDecision(d);
    setNote("");
    setFormError(null);
    setPoolForm({ minimumContribution: "", pricePerUnit: String(offer.price), endDate: "" });
  };

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
    if (decision === "APPROVED") {
      const minContribution = Number(poolForm.minimumContribution);
      const pricePerUnit = Number(poolForm.pricePerUnit);
      if (!minContribution || minContribution <= 0) {
        setFormError("Enter a minimum contribution greater than 0.");
        return;
      }
      if (minContribution > activeOffer.wholeQuantity) {
        setFormError("Minimum contribution cannot exceed the offer's quantity.");
        return;
      }
      if (!pricePerUnit || pricePerUnit <= 0) {
        setFormError("Enter a price per unit greater than 0.");
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
      await reviewOffer(activeOffer._id, { status: decision, adminComment: note.trim() || undefined });
      if (decision === "APPROVED") {
        await createPool({
          productoffer_ref: activeOffer._id,
          currentQuantity: activeOffer.wholeQuantity,
          minimumContribution: Number(poolForm.minimumContribution),
          pricePerUnit: Number(poolForm.pricePerUnit),
          endDate: endDateIso,
        });
      }
      close();
      refetch();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Could not process this decision.");
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
            <Card key={o._id}>
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
                <dl className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-slate-400">Quantity</dt>
                    <dd className="font-medium text-primary">{formatNumber(o.wholeQuantity)} {o.unit.toLowerCase()}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Price</dt>
                    <dd className="font-medium text-primary">{formatCurrency(o.price)}</dd>
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
          {decision === "APPROVED" && activeOffer && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <FieldWrapper label="Minimum contribution" htmlFor="minimumContribution" required>
                  <Input
                    id="minimumContribution"
                    type="number"
                    min={1}
                    max={activeOffer.wholeQuantity}
                    value={poolForm.minimumContribution}
                    onChange={(e) => setPoolForm((f) => ({ ...f, minimumContribution: e.target.value }))}
                  />
                </FieldWrapper>
                <FieldWrapper label="Price per unit (OMR)" htmlFor="pricePerUnit" required>
                  <Input
                    id="pricePerUnit"
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={poolForm.pricePerUnit}
                    onChange={(e) => setPoolForm((f) => ({ ...f, pricePerUnit: e.target.value }))}
                  />
                </FieldWrapper>
              </div>
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
