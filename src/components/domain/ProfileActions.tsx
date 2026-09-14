import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useFetch } from "@/hooks/useFetch";
import { listSupplierRemoveRequests } from "@/services/api";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { Modal } from "@/components/ui/Modal";
import { FieldWrapper, Input, Textarea } from "@/components/ui/Field";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ApiError } from "@/lib/http";

interface EditForm {
  firstName: string;
  lastName: string;
  companyName: string;
  phoneNumber: string;
  password: string;
}

interface ProfileActionsProps {
  /** Role-scoped path to this panel's address book page. */
  addressesPath: string;
}

// Shared by RetailerProfilePage and SupplierProfilePage — both need the
// same edit-profile / address-book / account-removal actions, differing
// only in which panel's address book to link to.
export function ProfileActions({ addressesPath }: ProfileActionsProps) {
  const { user, updateProfile, removeAccount } = useAuth();
  const navigate = useNavigate();
  const isSupplier = !!user?.roles.includes("SUPPLIER");

  // A SUPPLIER can't self-delete outright — check for an already-pending
  // removal request (role-scoped server-side to the caller's own) so
  // filing a second one while one is open is blocked in the UI too, not
  // just by the backend's 409.
  const { data: removeRequests, refetch: refetchRemoveRequests } = useFetch(
    () => (isSupplier ? listSupplierRemoveRequests() : Promise.resolve([])),
    [isSupplier],
  );
  const pendingRemoval = removeRequests?.find((r) => r.status === "PENDING");

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [removeOpen, setRemoveOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  if (!user) return null;

  const openEdit = () => {
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      companyName: user.companyName,
      phoneNumber: user.phoneNumber,
      password: "",
    });
    setEditError(null);
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!form) return;
    if (!form.firstName.trim() || !form.lastName.trim() || !form.companyName.trim() || !form.phoneNumber.trim()) {
      setEditError("All fields except password are required.");
      return;
    }
    if (form.password && form.password.length < 8) {
      setEditError("Password must be at least 8 characters.");
      return;
    }
    setSaving(true);
    setEditError(null);
    try {
      await updateProfile({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        companyName: form.companyName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        ...(form.password ? { password: form.password } : {}),
      });
      setEditOpen(false);
    } catch (e) {
      setEditError(e instanceof ApiError ? e.message : "Could not update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!reason.trim()) {
      setRemoveError("Please tell us why you're leaving.");
      return;
    }
    setRemoving(true);
    setRemoveError(null);
    try {
      const { deleted } = await removeAccount(reason.trim());
      if (deleted) {
        navigate("/login", { replace: true });
      } else {
        setRemoveOpen(false);
        setReason("");
        refetchRemoveRequests();
      }
    } catch (e) {
      setRemoveError(e instanceof ApiError ? e.message : "Could not submit request.");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-medium text-primary">Account settings</p>
            <p className="mt-1 text-sm text-slate-500">Update your details, or manage your delivery addresses.</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <LinkButton to={addressesPath} variant="outline">
              Addresses
            </LinkButton>
            <Button onClick={openEdit}>Edit profile</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardContent>
          <p className="font-medium text-primary">
            {isSupplier ? "Close your account" : "Delete your account"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {isSupplier
              ? "As a supplier, this opens a request for an admin to review before your account is removed."
              : "This permanently deletes your account. This cannot be undone."}
          </p>
          <div className="mt-3">
            {pendingRemoval ? (
              <div className="flex items-center gap-2">
                <StatusBadge status={pendingRemoval.status} domain="review" />
                <span className="text-sm text-slate-500">Your removal request is awaiting admin review.</span>
              </div>
            ) : (
              <Button variant="danger" onClick={() => setRemoveOpen(true)}>
                {isSupplier ? "Request account closure" : "Delete account"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {form && (
        <Modal
          open={editOpen}
          onClose={() => !saving && setEditOpen(false)}
          title="Edit profile"
          footer={
            <>
              <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} isLoading={saving}>
                Save
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FieldWrapper label="First name" htmlFor="edit-firstName" required>
                <Input id="edit-firstName" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </FieldWrapper>
              <FieldWrapper label="Last name" htmlFor="edit-lastName" required>
                <Input id="edit-lastName" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </FieldWrapper>
            </div>
            <FieldWrapper label="Company name" htmlFor="edit-company" required>
              <Input id="edit-company" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
            </FieldWrapper>
            <FieldWrapper label="Phone" htmlFor="edit-phone" required>
              <Input id="edit-phone" value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} />
            </FieldWrapper>
            <FieldWrapper
              label="New password"
              htmlFor="edit-password"
              hint="Leave blank to keep your current password."
              error={editError ?? undefined}
            >
              <Input
                id="edit-password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                hasError={!!editError}
              />
            </FieldWrapper>
          </div>
        </Modal>
      )}

      <Modal
        open={removeOpen}
        onClose={() => !removing && setRemoveOpen(false)}
        title={isSupplier ? "Request account closure" : "Delete your account?"}
        description={
          isSupplier
            ? "An admin will review this before your account is actually removed."
            : "This cannot be undone. Your account will be deleted immediately."
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setRemoveOpen(false)} disabled={removing}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleRemove} isLoading={removing}>
              {isSupplier ? "Submit request" : "Delete my account"}
            </Button>
          </>
        }
      >
        <FieldWrapper label="Reason" htmlFor="remove-reason" error={removeError ?? undefined} required>
          <Textarea
            id="remove-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you leaving?"
            hasError={!!removeError}
          />
        </FieldWrapper>
      </Modal>
    </div>
  );
}
