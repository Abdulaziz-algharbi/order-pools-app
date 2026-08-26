import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useFetch } from "@/hooks/useFetch";
import { createComplaint, listComplaints, listJoinsByRetailer, listPools } from "@/mocks/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FieldWrapper, Input, Select, Textarea } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Spinner";
import { AlertIcon, PlusIcon } from "@/components/ui/icons";
import { formatDate } from "@/lib/utils";
import type { RetailerUser } from "@/types/domain";

export function ComplaintsPage() {
  const { user } = useAuth();
  const retailer = user as RetailerUser;

  const { data: complaints, isLoading, error, refetch } = useFetch(
    () => listComplaints({ retailerId: retailer.id }),
    [retailer.id],
  );
  const { data: joins } = useFetch(() => listJoinsByRetailer(retailer.id), [retailer.id]);
  const { data: pools } = useFetch(() => listPools(), []);

  const [createOpen, setCreateOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [poolId, setPoolId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const myPoolIds = new Set((joins ?? []).map((j) => j.poolId));
  const myPools = (pools ?? []).filter((p) => myPoolIds.has(p.id));

  const resetForm = () => {
    setSubject("");
    setDescription("");
    setPoolId("");
    setFormError(null);
  };

  const handleSubmit = async () => {
    if (!subject.trim() || !description.trim()) {
      setFormError("Subject and description are required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await createComplaint({
        retailerId: retailer.id,
        retailerName: retailer.businessName,
        poolId: poolId || undefined,
        subject: subject.trim(),
        description: description.trim(),
      });
      setCreateOpen(false);
      resetForm();
      refetch();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not submit complaint.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Complaints"
        description="Raise an issue with a pool or delivery, and track its resolution."
        action={
          <Button
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
          >
            <PlusIcon className="h-4 w-4" /> New complaint
          </Button>
        }
      />

      {error ? (
        <ErrorState onRetry={refetch} />
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (complaints ?? []).length === 0 ? (
        <EmptyState
          icon={<AlertIcon className="h-8 w-8" />}
          title="No complaints yet"
          description="If something goes wrong with a pool or delivery, you can report it here."
        />
      ) : (
        <div className="space-y-3">
          {complaints!.map((c) => (
            <Card key={c.id}>
              <CardContent>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-primary">{c.subject}</h3>
                    <p className="mt-1 text-sm text-slate-500">{c.description}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
                <p className="mt-3 text-xs text-slate-400">Submitted {formatDate(c.createdAt)}</p>
                {c.response && (
                  <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
                    <p className="font-medium text-primary">Response</p>
                    <p className="mt-1 text-slate-600">{c.response}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New complaint"
        description="Tell us what happened — an administrator will review it."
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} isLoading={submitting}>
              Submit
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FieldWrapper label="Subject" htmlFor="subject" required>
            <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief summary" />
          </FieldWrapper>
          <FieldWrapper label="Related pool" htmlFor="pool" hint="Optional">
            <Select id="pool" value={poolId} onChange={(e) => setPoolId(e.target.value)}>
              <option value="">None</option>
              {myPools.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.productName}
                </option>
              ))}
            </Select>
          </FieldWrapper>
          <FieldWrapper label="Description" htmlFor="description" error={formError ?? undefined} required>
            <Textarea
              id="description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue in detail"
              hasError={!!formError}
            />
          </FieldWrapper>
        </div>
      </Modal>
    </div>
  );
}
