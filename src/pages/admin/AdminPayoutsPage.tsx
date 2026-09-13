import { useState } from "react";
import { useFetch } from "@/hooks/useFetch";
import { listPayouts, listPools, recordPayout } from "@/mocks/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FieldWrapper, Input, Select } from "@/components/ui/Field";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ApiError } from "@/lib/http";
import type { SupplierPayout, SupplierPayoutStatus } from "@/types/domain";

export function AdminPayoutsPage() {
  const { data: payouts, isLoading, error, refetch } = useFetch(() => listPayouts(), []);
  const { data: pools } = useFetch(() => listPools(), []);

  const [target, setTarget] = useState<SupplierPayout | null>(null);
  const [status, setStatus] = useState<SupplierPayoutStatus>("PROCESSING");
  const [transactionReference, setTransactionReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const poolName = (poolId: string) => (pools ?? []).find((p) => p._id === poolId)?.productName ?? poolId;

  const openRecord = (payout: SupplierPayout) => {
    setTarget(payout);
    setStatus(payout.status === "PENDING" ? "PROCESSING" : payout.status);
    setTransactionReference(payout.transactionReference ?? "");
    setFormError(null);
  };

  const handleSave = async () => {
    if (!target) return;
    if (status === "COMPLETED" && !transactionReference.trim()) {
      setFormError("A transaction reference is required to mark this paid.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await recordPayout(target._id, {
        status,
        ...(transactionReference.trim() ? { transactionReference: transactionReference.trim() } : {}),
      });
      setTarget(null);
      refetch();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Could not update payout.");
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<SupplierPayout>[] = [
    { key: "pool", header: "Pool", render: (p) => poolName(p.pool_ref) },
    { key: "amount", header: "Amount owed", render: (p) => formatCurrency(p.amount) },
    { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
    {
      key: "reference",
      header: "Transaction ref.",
      render: (p) => p.transactionReference ?? "—",
      hideOnMobileCard: true,
    },
    { key: "paidAt", header: "Paid", render: (p) => (p.paidAt ? formatDate(p.paidAt) : "—") },
    {
      key: "actions",
      header: "",
      render: (p) => (
        <Button size="sm" variant="outline" onClick={() => openRecord(p)}>
          Record
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Supplier Payouts"
        description="Amounts owed to suppliers for completed pools, and their manual transfer status."
      />

      {error ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={payouts ?? []}
          rowKey={(p) => p._id}
          isLoading={isLoading}
          emptyTitle="No payouts yet"
          emptyDescription="Payouts are created automatically once a pool's delivery is completed."
          renderMobileTitle={(p) => poolName(p.pool_ref)}
        />
      )}

      <Modal
        open={!!target}
        onClose={() => !saving && setTarget(null)}
        title="Record payout"
        description={target ? `${poolName(target.pool_ref)} — ${formatCurrency(target.amount)} owed.` : ""}
        footer={
          <>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} isLoading={saving}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FieldWrapper label="Status" htmlFor="payout-status">
            <Select
              id="payout-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as SupplierPayoutStatus)}
            >
              <option value="PROCESSING">Processing</option>
              <option value="COMPLETED">Completed (paid)</option>
              <option value="FAILED">Failed</option>
            </Select>
          </FieldWrapper>
          <FieldWrapper
            label="Transaction reference"
            htmlFor="payout-reference"
            hint="Your bank transfer reference — required to mark this Completed."
            error={formError ?? undefined}
          >
            <Input
              id="payout-reference"
              value={transactionReference}
              onChange={(e) => setTransactionReference(e.target.value)}
              hasError={!!formError}
            />
          </FieldWrapper>
        </div>
      </Modal>
    </div>
  );
}
