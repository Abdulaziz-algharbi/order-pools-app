import { useEffect, useState } from "react";
import { useFetch } from "@/hooks/useFetch";
import {
  createSupplierAccount,
  decideSupplierRequest,
  deleteUser,
  getUserById,
  listSupplierRequests,
  listSuppliers,
} from "@/mocks/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FieldWrapper, Input } from "@/components/ui/Field";
import { ErrorState } from "@/components/ui/ErrorState";
import { PlusIcon, TrashIcon } from "@/components/ui/icons";
import { formatDate } from "@/lib/utils";
import { ApiError } from "@/lib/http";
import type { AppUser, SupplierRequest } from "@/types/domain";

interface CreateForm {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  companyName: string;
  password: string;
  location: string;
  region: string;
  city: string;
  street: string;
}

const emptyForm: CreateForm = {
  firstName: "",
  lastName: "",
  email: "",
  phoneNumber: "",
  companyName: "",
  password: "",
  location: "",
  region: "",
  city: "",
  street: "",
};

export function AdminSuppliersPage() {
  const { data: suppliers, isLoading, error, refetch } = useFetch(() => listSuppliers(), []);
  const { data: requests, refetch: refetchRequests } = useFetch(() => listSupplierRequests(), []);
  const [requesterNames, setRequesterNames] = useState<Map<string, string>>(new Map());

  const pendingRequests = (requests ?? []).filter((r) => r.status === "PENDING");

  useEffect(() => {
    if (pendingRequests.length === 0) return;
    const uniqueIds = [...new Set(pendingRequests.map((r) => r.user_ref))];
    Promise.all(uniqueIds.map((id) => getUserById(id).catch(() => null))).then((users) => {
      setRequesterNames(
        new Map(users.filter((u): u is NonNullable<typeof u> => !!u).map((u) => [u._id, u.companyName])),
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests]);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [requestActionId, setRequestActionId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (
      !form.firstName.trim() ||
      !form.lastName.trim() ||
      !form.email.trim() ||
      !form.phoneNumber.trim() ||
      !form.companyName.trim() ||
      !form.password ||
      !form.location.trim() ||
      !form.region.trim() ||
      !form.city.trim()
    ) {
      setFormError("All fields except street are required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await createSupplierAccount({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phoneNumber: form.phoneNumber.trim(),
        companyName: form.companyName.trim(),
        password: form.password,
        address: {
          location: form.location.trim(),
          region: form.region.trim(),
          city: form.city.trim(),
          street: form.street.trim() || undefined,
        },
      });
      setCreateOpen(false);
      setForm(emptyForm);
      refetch();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Could not create supplier.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteUser(deleteTarget._id);
      setDeleteTarget(null);
      refetch();
    } finally {
      setDeleting(false);
    }
  };

  const handleRequestDecision = async (req: SupplierRequest, status: "APPROVED" | "REJECTED") => {
    setRequestActionId(req._id);
    try {
      await decideSupplierRequest(req._id, { status });
      refetchRequests();
      if (status === "APPROVED") refetch();
    } finally {
      setRequestActionId(null);
    }
  };

  const columns: Column<AppUser>[] = [
    {
      key: "company",
      header: "Company",
      render: (s) => (
        <div>
          <p className="font-medium text-primary">{s.companyName}</p>
          <p className="text-xs text-slate-400">{s.firstName} {s.lastName}</p>
        </div>
      ),
    },
    { key: "email", header: "Email", render: (s) => s.email },
    { key: "since", header: "Since", render: (s) => formatDate(s.createdAt) },
    {
      key: "actions",
      header: "",
      render: (s) => (
        <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(s)} aria-label={`Delete ${s.companyName}`}>
          <TrashIcon className="h-4 w-4 text-red-600" />
        </Button>
      ),
    },
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
          <PageHeader title="Pending supplier requests" description="Retailers who have requested to also become a supplier." />
          <div className="space-y-3">
            {pendingRequests.map((req) => (
              <Card key={req._id}>
                <CardContent className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-primary">{requesterNames.get(req.user_ref) ?? "…"}</p>
                    <p className="mt-1 text-sm text-slate-600">{req.description}</p>
                    <p className="mt-1 text-xs text-slate-400">Submitted {formatDate(req.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRequestDecision(req, "REJECTED")}
                      isLoading={requestActionId === req._id}
                    >
                      Reject
                    </Button>
                    <Button size="sm" onClick={() => handleRequestDecision(req, "APPROVED")} isLoading={requestActionId === req._id}>
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
            rowKey={(s) => s._id}
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
          <div className="grid grid-cols-2 gap-4">
            <FieldWrapper label="First name" htmlFor="s-firstName" required>
              <Input id="s-firstName" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </FieldWrapper>
            <FieldWrapper label="Last name" htmlFor="s-lastName" required>
              <Input id="s-lastName" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </FieldWrapper>
          </div>
          <FieldWrapper label="Company name" htmlFor="s-company" required>
            <Input id="s-company" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
          </FieldWrapper>
          <FieldWrapper label="Email" htmlFor="s-email" required>
            <Input id="s-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </FieldWrapper>
          <div className="grid grid-cols-2 gap-4">
            <FieldWrapper label="Phone" htmlFor="s-phone" required>
              <Input id="s-phone" value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} />
            </FieldWrapper>
            <FieldWrapper label="Temporary password" htmlFor="s-password" required>
              <Input
                id="s-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </FieldWrapper>
          </div>
          <FieldWrapper label="Address — map link" htmlFor="s-location" required>
            <Input id="s-location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="https://…" />
          </FieldWrapper>
          <div className="grid grid-cols-2 gap-4">
            <FieldWrapper label="City" htmlFor="s-city" required>
              <Input id="s-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </FieldWrapper>
            <FieldWrapper label="Region" htmlFor="s-region" required>
              <Input id="s-region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
            </FieldWrapper>
          </div>
          <FieldWrapper label="Street" htmlFor="s-street" hint="Optional">
            <Input id="s-street" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
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
