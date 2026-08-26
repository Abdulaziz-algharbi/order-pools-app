import { useState } from "react";
import { useFetch } from "@/hooks/useFetch";
import { decideOffer, listOffers, type OfferDecision } from "@/mocks/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FieldWrapper, Textarea } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Spinner";
import { ListIcon } from "@/components/ui/icons";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import type { SupplierOffer } from "@/types/domain";

export function AdminOffersPage() {
  const { data: offers, isLoading, error, refetch } = useFetch(
    () => listOffers({ status: ["pending_review", "negotiation"] }),
    [],
  );

  const [activeOffer, setActiveOffer] = useState<SupplierOffer | null>(null);
  const [decision, setDecision] = useState<OfferDecision | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const openDecision = (offer: SupplierOffer, d: OfferDecision) => {
    setActiveOffer(offer);
    setDecision(d);
    setNote("");
  };

  const close = () => {
    setActiveOffer(null);
    setDecision(null);
  };

  const confirm = async () => {
    if (!activeOffer || !decision) return;
    if (decision !== "accepted" && !note.trim()) return;
    setSubmitting(true);
    try {
      await decideOffer(activeOffer.id, decision, note.trim() || undefined);
      close();
      refetch();
    } finally {
      setSubmitting(false);
    }
  };

  const decisionCopy: Record<OfferDecision, { title: string; description: string; confirmLabel: string; noteRequired: boolean }> = {
    accepted: {
      title: "Accept this offer?",
      description: "This will create an active pool that retailers can immediately join.",
      confirmLabel: "Accept offer",
      noteRequired: false,
    },
    negotiation: {
      title: "Request negotiation",
      description: "Explain what needs to change before this offer can be accepted.",
      confirmLabel: "Send for negotiation",
      noteRequired: true,
    },
    refused: {
      title: "Refuse this offer?",
      description: "Explain why this offer is being refused.",
      confirmLabel: "Refuse offer",
      noteRequired: true,
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
            <Card key={o.id}>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      {o.category} &middot; {o.supplierName}
                    </p>
                    <h3 className="mt-0.5 font-heading text-base font-semibold text-primary">{o.productName}</h3>
                  </div>
                  <StatusBadge status={o.status} />
                </div>
                <p className="text-sm text-slate-600">{o.productDescription}</p>
                <dl className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-slate-400">Target qty</dt>
                    <dd className="font-medium text-primary">{formatNumber(o.targetQuantity)} {o.unit}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Min. contribution</dt>
                    <dd className="font-medium text-primary">{formatNumber(o.minContribution)} {o.unit}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Unit price</dt>
                    <dd className="font-medium text-primary">{formatCurrency(o.unitPrice)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Proposed deadline</dt>
                    <dd className="font-medium text-primary">{formatDate(o.proposedDeadline)}</dd>
                  </div>
                </dl>
                {o.adminNote && (
                  <div className="rounded-lg border border-tertiary/20 bg-tertiary/5 p-3 text-sm text-slate-600">
                    <span className="font-medium text-primary">Previous note: </span>
                    {o.adminNote}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => openDecision(o, "accepted")}>
                    Accept
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openDecision(o, "negotiation")}>
                    Request negotiation
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => openDecision(o, "refused")}>
                    Refuse
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
              variant={decision === "refused" ? "danger" : "primary"}
              onClick={confirm}
              isLoading={submitting}
              disabled={decision !== "accepted" && !note.trim()}
            >
              {decision ? decisionCopy[decision].confirmLabel : "Confirm"}
            </Button>
          </>
        }
      >
        {decision && decisionCopy[decision].noteRequired && (
          <FieldWrapper label="Note to supplier" htmlFor="admin-note" required>
            <Textarea id="admin-note" rows={4} value={note} onChange={(e) => setNote(e.target.value)} />
          </FieldWrapper>
        )}
      </Modal>
    </div>
  );
}
