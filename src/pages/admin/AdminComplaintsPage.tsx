import { useState } from "react";
import { useFetch } from "@/hooks/useFetch";
import { listComplaints, respondToComplaint } from "@/mocks/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FieldWrapper, Select, Textarea } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Spinner";
import { AlertIcon } from "@/components/ui/icons";
import { formatDate } from "@/lib/utils";
import type { Complaint, ComplaintStatus } from "@/types/domain";

export function AdminComplaintsPage() {
  const { data: complaints, isLoading, error, refetch } = useFetch(() => listComplaints(), []);

  const [activeComplaint, setActiveComplaint] = useState<Complaint | null>(null);
  const [response, setResponse] = useState("");
  const [status, setStatus] = useState<ComplaintStatus>("resolved");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const openRespond = (c: Complaint) => {
    setActiveComplaint(c);
    setResponse(c.response ?? "");
    setStatus(c.status === "open" ? "in_review" : c.status);
    setFormError(null);
  };

  const handleRespond = async () => {
    if (!activeComplaint) return;
    if (!response.trim()) {
      setFormError("A response is required.");
      return;
    }
    setSubmitting(true);
    try {
      await respondToComplaint(activeComplaint.id, response.trim(), status);
      setActiveComplaint(null);
      refetch();
    } finally {
      setSubmitting(false);
    }
  };

  const sorted = [...(complaints ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div>
      <PageHeader title="Complaints" description="Complaints submitted by retailers, awaiting or under review." />

      {error ? (
        <ErrorState onRetry={refetch} />
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState icon={<AlertIcon className="h-8 w-8" />} title="No complaints" description="Nothing has been reported yet." />
      ) : (
        <div className="space-y-3">
          {sorted.map((c) => (
            <Card key={c.id}>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-400">{c.retailerName} &middot; {formatDate(c.createdAt)}</p>
                    <h3 className="font-medium text-primary">{c.subject}</h3>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
                <p className="text-sm text-slate-600">{c.description}</p>
                {c.response && (
                  <div className="rounded-lg bg-slate-50 p-3 text-sm">
                    <p className="font-medium text-primary">Response</p>
                    <p className="mt-1 text-slate-600">{c.response}</p>
                  </div>
                )}
                {c.status !== "resolved" && c.status !== "dismissed" && (
                  <Button size="sm" onClick={() => openRespond(c)}>
                    Respond
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!activeComplaint}
        onClose={() => setActiveComplaint(null)}
        title="Respond to complaint"
        description={activeComplaint?.subject}
        footer={
          <>
            <Button variant="outline" onClick={() => setActiveComplaint(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleRespond} isLoading={submitting}>
              Send response
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FieldWrapper label="Resolution" htmlFor="status" required>
            <Select id="status" value={status} onChange={(e) => setStatus(e.target.value as ComplaintStatus)}>
              <option value="in_review">In review</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </Select>
          </FieldWrapper>
          <FieldWrapper label="Response" htmlFor="response" error={formError ?? undefined} required>
            <Textarea id="response" rows={4} value={response} onChange={(e) => setResponse(e.target.value)} hasError={!!formError} />
          </FieldWrapper>
        </div>
      </Modal>
    </div>
  );
}
