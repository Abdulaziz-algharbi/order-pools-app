import { useEffect, useState } from "react";
import { useFetch } from "@/hooks/useFetch";
import {
  createSupplierAccount,
  decideSupplierRemoveRequest,
  decideSupplierRequest,
  deleteUser,
  getUserById,
  listSupplierRemoveRequests,
  listSupplierRequests,
  listSuppliers,
} from "@/services/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FieldWrapper, Input, Textarea } from "@/components/ui/Field";
import { ErrorState } from "@/components/ui/ErrorState";
import { PlusIcon, TrashIcon } from "@/components/ui/icons";
import { formatDate } from "@/lib/utils";
import { ApiError } from "@/lib/http";
import type { AppUser, SupplierRemoveRequest, SupplierRequest } from "@/types/domain";

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
  const { data: removeRequests, refetch: refetchRemoveRequests } = useFetch(
    () => listSupplierRemoveRequests(),
    [],
  );
  const [requesterNames, setRequesterNames] = useState<Map<string, string>>(new Map());
  const [removalRequesterNames, setRemovalRequesterNames] = useState<Map<string, string>>(new Map());

  const pendingRequests = (requests ?? []).filter((r) => r.status === "PENDING");
  const pendingRemoveRequests = (removeRequests ?? []).filter((r) => r.status === "PENDING");

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

  useEffect(() => {
    if (pendingRemoveRequests.length === 0) return;
    const uniqueIds = [...new Set(pendingRemoveRequests.map((r) => r.user_ref))];
    Promise.all(uniqueIds.map((id) => getUserById(id).catch(() => null))).then((users) => {
      setRemovalRequesterNames(
        new Map(users.filter((u): u is NonNullable<typeof u> => !!u).map((u) => [u._id, u.companyName])),
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [removeRequests]);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [requestActionId, setRequestActionId] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<SupplierRequest | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);

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

  const handleApproveRequest = async (req: SupplierRequest) => {
    setRequestActionId(req._id);
    setRequestError(null);
    try {
      await decideSupplierRequest(req._id, { status: "APPROVED" });
      refetchRequests();
      refetch();
    } catch (e) {
      setRequestError(e instanceof ApiError ? e.message : "Could not approve the request.");
    } finally {
      setRequestActionId(null);
    }
  };

  const openRejectModal = (req: SupplierRequest) => {
    setRejectTarget(req);
    setRejectNote("");
    setRejectError(null);
  };

  // The note is optional but is shown to the retailer on their profile
  // and in their rejection notification, so they know what to fix before
  // requesting again.
  const handleRejectRequest = async () => {
    if (!rejectTarget) return;
    setRejecting(true);
    setRejectError(null);
    try {
      const note = rejectNote.trim();
      await decideSupplierRequest(rejectTarget._id, {
        status: "REJECTED",
        ...(note && { adminComment: note }),
      });
      setRejectTarget(null);
      refetchRequests();
    } catch (e) {
      setRejectError(e instanceof ApiError ? e.message : "Could not reject the request.");
    } finally {
      setRejecting(false);
    }
  };

  const [removeActionId, setRemoveActionId] = useState<string | null>(null);

  // Approving actually deletes the requester's account (see
  // SupplierRemoveRequestController.update) — refetch the supplier list
  // too so the now-gone account drops out of "All suppliers" immediately.
  const handleRemoveRequestDecision = async (
    req: SupplierRemoveRequest,
    status: "APPROVED" | "REJECTED",
  ) => {
    setRemoveActionId(req._id);
    try {
      await decideSupplierRemoveRequest(req._id, { status });
      refetchRemoveRequests();
      if (status === "APPROVED") refetch();
    } finally {
      setRemoveActionId(null);
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
          {requestError && <p className="mb-3 text-sm text-red-600">{requestError}</p>}
          <div className="space-y-3">
            {pendingRequests.map((req) => (
              <Card key={req._id}>
                <CardContent className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-primary">{requesterNames.get(req.user_ref) ?? "…"}</p>
                    <p className="mt-1 text-sm text-slate-600">{req.description}</p>
                    <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs">
                      <div>
                        <dt className="inline text-slate-400">CR: </dt>
                        <dd className="inline font-medium text-primary">{req.commercialRegistration ?? "Not provided"}</dd>
                      </div>
                      <div>
                        <dt className="inline text-slate-400">VAT: </dt>
                        <dd className="inline font-medium text-primary">{req.vatNumber ?? "Not provided"}</dd>
                      </div>
                    </dl>
                    <p className="mt-1 text-xs text-slate-400">Submitted {formatDate(req.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openRejectModal(req)}
                      disabled={requestActionId === req._id}
                    >
                      Reject
                    </Button>
                    <Button size="sm" onClick={() => handleApproveRequest(req)} isLoading={requestActionId === req._id}>
                      Approve
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {pendingRemoveRequests.length > 0 && (
        <section>
          <PageHeader
            title="Pending account-removal requests"
            description="Suppliers who have asked to close their account."
          />
          <div className="space-y-3">
            {pendingRemoveRequests.map((req) => (
              <Card key={req._id}>
                <CardContent className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-primary">{removalRequesterNames.get(req.user_ref) ?? "…"}</p>
                    <p className="mt-1 text-sm text-slate-600">{req.reason}</p>
                    <p className="mt-1 text-xs text-slate-400">Submitted {formatDate(req.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRemoveRequestDecision(req, "REJECTED")}
                      isLoading={removeActionId === req._id}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleRemoveRequestDecision(req, "APPROVED")}
                      isLoading={removeActionId === req._id}
                    >
                      Approve &amp; delete account
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
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Reject supplier request?"
        description={
          rejectTarget
            ? `${requesterNames.get(rejectTarget.user_ref) ?? "The retailer"} will be notified and can request again later.`
            : ""
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setRejectTarget(null)} disabled={rejecting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleRejectRequest} isLoading={rejecting}>
              Reject request
            </Button>
          </>
        }
      >
        <FieldWrapper
          label="Note to the retailer"
          htmlFor="reject-note"
          hint="Optional — shown to the retailer so they know what to change."
          error={rejectError ?? undefined}
        >
          <Textarea
            id="reject-note"
            rows={3}
            maxLength={2000}
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="e.g. Please add your commercial registration number to your profile first."
            hasError={!!rejectError}
          />
        </FieldWrapper>
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
