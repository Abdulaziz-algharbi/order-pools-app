import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useFetch } from "@/hooks/useFetch";
import { createSupplierRequest, listMyAddresses, listSupplierRequests } from "@/services/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProfileCard } from "@/components/domain/ProfileCard";
import { ProfileActions } from "@/components/domain/ProfileActions";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FieldWrapper, Textarea } from "@/components/ui/Field";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/utils";
import { ApiError } from "@/lib/http";

export function RetailerProfilePage() {
  const { user } = useAuth();
  const { data: addresses } = useFetch(() => listMyAddresses(), []);
  // Role-scoped server-side to just this caller's own requests (see
  // supplier.requests.controller.ts) — no filtering needed here.
  const { data: requests, refetch: refetchRequests } = useFetch(() => listSupplierRequests(), []);

  const [requestOpen, setRequestOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!user) return null;

  const isSupplier = user.roles.includes("SUPPLIER");
  // Most recent request stands for current status — a new one can't be
  // filed while one is already PENDING (see supplier.requests.controller.ts),
  // so at most one PENDING request ever exists at a time.
  const latestRequest = requests?.[0];

  const handleSubmit = async () => {
    if (!description.trim()) {
      setFormError("Please describe your business.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await createSupplierRequest(description.trim());
      setRequestOpen(false);
      setDescription("");
      refetchRequests();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Could not submit request.");
    } finally {
      setSubmitting(false);
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
                <Button onClick={() => setRequestOpen(true)}>Request supplier access</Button>
              )}
            </div>
            {latestRequest?.status === "REJECTED" && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                {latestRequest.adminComment && (
                  <p className="text-slate-600">
                    <span className="font-medium text-primary">Admin note: </span>
                    {latestRequest.adminComment}
                  </p>
                )}
                <Button size="sm" variant="outline" className="mt-2" onClick={() => setRequestOpen(true)}>
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
        <FieldWrapper label="About your business" htmlFor="supplier-description" error={formError ?? undefined} required>
          <Textarea
            id="supplier-description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What do you sell, and how much can you supply?"
            hasError={!!formError}
          />
        </FieldWrapper>
      </Modal>
    </div>
  );
}
