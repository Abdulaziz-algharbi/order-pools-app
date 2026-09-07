import { useState } from "react";
import { useFetch } from "@/hooks/useFetch";
import { createComplaint, listComplaints, listMyParticipants, listPools } from "@/mocks/api";
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
import { ApiError } from "@/lib/http";

export function ComplaintsPage() {
  const { data: complaints, isLoading, error, refetch } = useFetch(() => listComplaints(), []);
  const { data: participants } = useFetch(() => listMyParticipants(), []);
  const { data: pools } = useFetch(() => listPools(), []);

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [poolId, setPoolId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const myPoolIds = new Set((participants ?? []).map((p) => p.pool_ref));
  const myPools = (pools ?? []).filter((p) => myPoolIds.has(p._id));

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPoolId("");
    setFormError(null);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim() || !poolId) {
      setFormError("Related pool, title, and description are required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await createComplaint({
        pool_ref: poolId,
        title: title.trim(),
        description: description.trim(),
      });
      setCreateOpen(false);
      resetForm();
      refetch();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Could not submit complaint.");
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
            <Card key={c._id}>
              <CardContent>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-primary">{c.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">{c.description}</p>
                  </div>
                  <StatusBadge status={c.status} domain="complaint" />
                </div>
                {c.resolution && (
                  <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
                    <p className="font-medium text-primary">Response</p>
                    <p className="mt-1 text-slate-600">{c.resolution}</p>
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
          <FieldWrapper label="Related pool" htmlFor="pool" required>
            <Select id="pool" value={poolId} onChange={(e) => setPoolId(e.target.value)}>
              <option value="">Select a pool</option>
              {myPools.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.productName}
                </option>
              ))}
            </Select>
          </FieldWrapper>
          <FieldWrapper label="Title" htmlFor="title" required>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brief summary" />
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
