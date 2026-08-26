import { useState } from "react";
import { useFetch } from "@/hooks/useFetch";
import {
  createSupplier,
  decideSupplierRequest,
  deleteSupplier,
  listSupplierRequests,
  listSuppliers,
} from "@/mocks/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FieldWrapper, Input } from "@/components/ui/Field";
import { ErrorState } from "@/components/ui/ErrorState";
import { PlusIcon, TrashIcon } from "@/components/ui/icons";
import { formatDate } from "@/lib/utils";
import type { SupplierRequest, SupplierUser } from "@/types/domain";

interface CreateForm {
  name: string;
  email: string;
  companyName: string;
  phone: string;
  address: string;
}

const emptyForm: CreateForm = { name: "", email: "", companyName: "", phone: "", address: "" };

export function AdminSuppliersPage() {
  const { data: suppliers, isLoading, error, refetch } = useFetch(() => listSuppliers(), []);
  const { data: requests, refetch: refetchRequests } = useFetch(() => listSupplierRequests(), []);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SupplierUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [requestActionId, setRequestActionId] = useState<string | null>(null);

  const pendingRequests = (requests ?? []).filter((r) => r.status === "pending");

  const handleCreate = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.companyName.trim()) {
      setFormError("Name, email, and company name are required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await createSupplier({
        name: form.name.trim(),
        email: form.email.trim(),
        companyName: form.companyName.trim(),
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
      });
      setCreateOpen(false);
      setForm(emptyForm);
      refetch();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSupplier(deleteTarget.id);
      setDeleteTarget(null);
      refetch();
    } finally {
      setDeleting(false);
    }
  };

  const handleRequestDecision = async (req: SupplierRequest, decision: "approved" | "rejected") => {
    setRequestActionId(req.id);
    try {
      await decideSupplierRequest(req.id, decision);
      refetchRequests();
      if (decision === "approved") refetch();
    } finally {
      setRequestActionId(null);
    }
  };

  const columns: Column<SupplierUser>[] = [
    { key: "company", header: "Company", render: (s) => (
      <div>
        <p className="font-medium text-primary">{s.companyName}</p>
        <p className="text-xs text-slate-400">{s.name}</p>
      </div>
    ) },
    { key: "email", header: "Email", render: (s) => s.email },
    { key: "verified", header: "Status", render: (s) => <StatusBadge status={s.verified ? "approved" : "pending"} /> },
    { key: "since", header: "Since", render: (s) => formatDate(s.createdAt) },
    { key: "actions", header: "", render: (s) => (
      <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(s)} aria-label={`Delete ${s.companyName}`}>
        <TrashIcon className="h-4 w-4 text-red-600" />
      </Button>
    ) },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Suppliers"
        description="Manage supplier accounts on the platform."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <PlusIcon className="h-4 w-4" /> Add supplier
          </Button>
        }
      />

      {pendingRequests.length > 0 && (
        <section>
          <PageHeader title="Pending supplier requests" description="Users who have requested to become a supplier." />
          <div className="space-y-3">
            {pendingRequests.map((req) => (
              <Card key={req.id}>
                <CardContent className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-primary">{req.companyName}</p>
                    <p className="text-sm text-slate-500">{req.applicantName} &middot; {req.applicantEmail}</p>
                    <p className="mt-1 text-sm text-slate-600">{req.message}</p>
                    <p className="mt-1 text-xs text-slate-400">Submitted {formatDate(req.submittedAt)}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRequestDecision(req, "rejected")}
                      isLoading={requestActionId === req.id}
                    >
                      Reject
                    </Button>
                    <Button size="sm" onClick={() => handleRequestDecision(req, "approved")} isLoading={requestActionId === req.id}>
                      Approve
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <PageHeader title="All suppliers" />
        {error ? (
          <ErrorState onRetry={refetch} />
        ) : (
          <DataTable
            columns={columns}
            data={suppliers ?? []}
            rowKey={(s) => s.id}
            isLoading={isLoading}
            emptyTitle="No suppliers yet"
            renderMobileTitle={(s) => s.companyName}
          />
        )}
      </section>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add supplier"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleCreate} isLoading={submitting}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FieldWrapper label="Contact name" htmlFor="s-name" required>
            <Input id="s-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </FieldWrapper>
          <FieldWrapper label="Company name" htmlFor="s-company" required>
            <Input id="s-company" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
          </FieldWrapper>
          <FieldWrapper label="Email" htmlFor="s-email" required>
            <Input id="s-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </FieldWrapper>
          <FieldWrapper label="Phone" htmlFor="s-phone" hint="Optional">
            <Input id="s-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </FieldWrapper>
          <FieldWrapper label="Address" htmlFor="s-address" hint="Optional">
            <Input id="s-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </FieldWrapper>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
        </div>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete supplier?"
        description={deleteTarget ? `This will remove ${deleteTarget.companyName} from the platform. This cannot be undone.` : ""}
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
