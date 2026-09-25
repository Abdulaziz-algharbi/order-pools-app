import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useFetch } from "@/hooks/useFetch";
import { createSupplierRequest, listMyAddresses, listSupplierRequests } from "@/services/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProfileCard } from "@/components/domain/ProfileCard";
import { ProfileActions } from "@/components/domain/ProfileActions";
import { EmailVerificationRequired } from "@/components/domain/EmailVerification";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FieldWrapper, Input, Textarea } from "@/components/ui/Field";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/utils";
import { ApiError } from "@/lib/http";

interface RequestForm {
  description: string;
  commercialRegistration: string;
  vatNumber: string;
}

export function RetailerProfilePage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { data: addresses } = useFetch(() => listMyAddresses(), []);
  // Role-scoped server-side to just this caller's own requests (see
  // supplier.requests.controller.ts) — no filtering needed here.
  const { data: requests, refetch: refetchRequests } = useFetch(() => listSupplierRequests(), []);

  const [requestOpen, setRequestOpen] = useState(false);
  const [form, setForm] = useState<RequestForm>({
    description: "",
    commercialRegistration: "",
    vatNumber: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [openingPanel, setOpeningPanel] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);

  if (!user) return null;

  const isSupplier = user.roles.includes("SUPPLIER");
  // Most recent request stands for current status — a new one can't be
  // filed while one is already PENDING (see supplier.requests.controller.ts),
  // so at most one PENDING request ever exists at a time.
  const latestRequest = requests?.[0];

  // Identifiers start from the profile (the user may already have entered
  // them there), and from the previous request when requesting again.
  const openRequestForm = () => {
    setForm({
      description: latestRequest?.description ?? "",
      commercialRegistration:
        latestRequest?.commercialRegistration ?? user.commercialRegistration ?? "",
      vatNumber: latestRequest?.vatNumber ?? user.vatNumber ?? "",
    });
    setFormError(null);
    setRequestOpen(true);
  };

  const handleSubmit = async () => {
    const description = form.description.trim();
    const commercialRegistration = form.commercialRegistration.trim();
    const vatNumber = form.vatNumber.trim();
    if (!description) {
      setFormError("Please describe your business.");
      return;
    }
    if (!commercialRegistration) {
      setFormError("Please enter your commercial registration number.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await createSupplierRequest({
        description,
        commercialRegistration,
        ...(vatNumber && { vatNumber }),
      });
      setRequestOpen(false);
      refetchRequests();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Could not submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  // Reached only while this session still predates the approval (this
  // card is hidden once `user` holds SUPPLIER). Re-reading /auth/me both
  // picks up the new role here and has the backend re-issue the session
  // cookies with it, so supplier API calls stop being rejected.
  const handleOpenSupplierPanel = async () => {
    setOpeningPanel(true);
    setPanelError(null);
    try {
      const me = await refreshUser();
      if (me.roles.includes("SUPPLIER")) {
        navigate("/supplier");
      } else {
        setPanelError("Supplier access isn't active on your account yet. Please try again shortly.");
      }
    } catch (e) {
      setPanelError(e instanceof ApiError ? e.message : "Could not load supplier access.");
    } finally {
      setOpeningPanel(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Profile" description="Your account and business information." />
      <ProfileCard
        name={user.companyName}
        subtitle={`${user.firstName} ${user.lastName}`}
        email={user.email}
        fields={[
          { label: "Phone", value: user.phoneNumber || "—" },
          {
            label: "Addresses",
            value: addresses ? `${addresses.length} saved` : "—",
          },
          { label: "Member since", value: formatDate(user.createdAt) },
          { label: "Role", value: "Retailer" },
        ]}
      />

      <ProfileActions addressesPath="/retailer/addresses" />

      {!isSupplier && (
        <Card className="mx-auto max-w-2xl">
          <CardContent>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-medium text-primary">Become a supplier</p>
                <p className="mt-1 text-sm text-slate-500">
                  {latestRequest
                    ? "Your request to also become a supplier:"
                    : "Sell wholesale on Order Pool without giving up your retailer account."}
                </p>
              </div>
              {latestRequest ? (
                <StatusBadge status={latestRequest.status} domain="review" />
              ) : (
                <Button onClick={openRequestForm} disabled={!user.isVerified}>
                  Request supplier access
                </Button>
              )}
            </div>
            {!user.isVerified && (!latestRequest || latestRequest.status === "REJECTED") && (
              <div className="mt-3">
                <EmailVerificationRequired action="request supplier access" />
              </div>
            )}
            {latestRequest?.status === "APPROVED" && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="text-slate-600">Your request was approved — you can now sell as a supplier.</p>
                {panelError && <p className="mt-2 text-red-600">{panelError}</p>}
                <Button size="sm" className="mt-2" onClick={handleOpenSupplierPanel} isLoading={openingPanel}>
                  Open supplier panel
                </Button>
              </div>
            )}
            {latestRequest?.status === "REJECTED" && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                {latestRequest.adminComment && (
                  <p className="text-slate-600">
                    <span className="font-medium text-primary">Admin note: </span>
                    {latestRequest.adminComment}
                  </p>
                )}
                <Button size="sm" variant="outline" className="mt-2" onClick={openRequestForm} disabled={!user.isVerified}>
                  Request again
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Modal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        title="Request supplier access"
        description="Tell an admin about your business — they'll review this request."
        footer={
          <>
            <Button variant="outline" onClick={() => setRequestOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} isLoading={submitting}>
              Submit request
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FieldWrapper label="About your business" htmlFor="supplier-description" required>
            <Textarea
              id="supplier-description"
              rows={4}
              maxLength={2000}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What do you sell, and how much can you supply?"
            />
          </FieldWrapper>
          <FieldWrapper label="Commercial registration (CR) number" htmlFor="supplier-cr" required>
            <Input
              id="supplier-cr"
              maxLength={50}
              value={form.commercialRegistration}
              onChange={(e) => setForm({ ...form, commercialRegistration: e.target.value })}
            />
          </FieldWrapper>
          <FieldWrapper
            label="VAT number"
            htmlFor="supplier-vat"
            hint="Optional — only if your business is VAT-registered."
          >
            <Input
              id="supplier-vat"
              maxLength={50}
              value={form.vatNumber}
              onChange={(e) => setForm({ ...form, vatNumber: e.target.value })}
            />
          </FieldWrapper>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
        </div>
      </Modal>
    </div>
  );
}
