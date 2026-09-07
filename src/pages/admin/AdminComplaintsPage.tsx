import { useEffect, useState } from "react";
import { useFetch } from "@/hooks/useFetch";
import { getUserById, listComplaints, respondToComplaint } from "@/mocks/api";
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
import type { Complaint, ComplaintStatus } from "@/types/domain";

export function AdminComplaintsPage() {
  const { data: complaints, isLoading, error, refetch } = useFetch(() => listComplaints(), []);
  const [creatorNames, setCreatorNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!complaints || complaints.length === 0) return;
    const uniqueIds = [...new Set(complaints.map((c) => c.creator_ref))];
    Promise.all(uniqueIds.map((id) => getUserById(id).catch(() => null))).then((users) => {
      setCreatorNames(
        new Map(users.filter((u): u is NonNullable<typeof u> => !!u).map((u) => [u._id, u.companyName])),
      );
    });
  }, [complaints]);

  const [activeComplaint, setActiveComplaint] = useState<Complaint | null>(null);
  const [resolution, setResolution] = useState("");
  const [status, setStatus] = useState<ComplaintStatus>("RESOLVED");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const openRespond = (c: Complaint) => {
    setActiveComplaint(c);
    setResolution(c.resolution ?? "");
    setStatus(c.status === "OPEN" ? "UNDER REVIEW" : c.status);
    setFormError(null);
  };

  const handleRespond = async () => {
    if (!activeComplaint) return;
    if (!resolution.trim()) {
      setFormError("A response is required.");
      return;
    }
    setSubmitting(true);
    try {
      await respondToComplaint(activeComplaint._id, { resolution: resolution.trim(), status });
      setActiveComplaint(null);
      refetch();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader title="Complaints" description="Complaints submitted by retailers and suppliers, awaiting or under review." />

      {error ? (
        <ErrorState onRetry={refetch} />
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : (complaints ?? []).length === 0 ? (
        <EmptyState icon={<AlertIcon className="h-8 w-8" />} title="No complaints" description="Nothing has been reported yet." />
      ) : (
        <div className="space-y-3">
          {complaints!.map((c) => (
            <Card key={c._id}>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-400">{creatorNames.get(c.creator_ref) ?? "…"}</p>
                    <h3 className="font-medium text-primary">{c.title}</h3>
                  </div>
                  <StatusBadge status={c.status} domain="complaint" />
                </div>
                <p className="text-sm text-slate-600">{c.description}</p>
                {c.resolution && (
                  <div className="rounded-lg bg-slate-50 p-3 text-sm">
                    <p className="font-medium text-primary">Response</p>
                    <p className="mt-1 text-slate-600">{c.resolution}</p>
                  </div>
                )}
                {c.status !== "RESOLVED" && (
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
        description={activeComplaint?.title}
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
          <FieldWrapper label="Resolution status" htmlFor="status" required>
            <Select id="status" value={status} onChange={(e) => setStatus(e.target.value as ComplaintStatus)}>
              <option value="UNDER REVIEW">Under review</option>
              <option value="RESOLVED">Resolved</option>
            </Select>
          </FieldWrapper>
          <FieldWrapper label="Response" htmlFor="resolution" error={formError ?? undefined} required>
            <Textarea id="resolution" rows={4} value={resolution} onChange={(e) => setResolution(e.target.value)} hasError={!!formError} />
          </FieldWrapper>
        </div>
      </Modal>
    </div>
  );
}
