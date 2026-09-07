import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { cancelPayment, confirmPayment } from "@/mocks/api";
import { Card, CardContent } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageSpinner } from "@/components/ui/Spinner";
import { CheckIcon, AlertIcon } from "@/components/ui/icons";
import { formatCurrency } from "@/lib/utils";
import { ApiError } from "@/lib/http";
import type { Payment } from "@/types/domain";

/**
 * Thawani redirects the browser here after checkout — the URL and outcome
 * query param are dictated by the backend's successUrl/cancelUrl
 * (see PoolParticipantController.create). This reconciles the payment
 * against Thawani's own record rather than trusting the query string.
 */
export function PaymentResultPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const [searchParams] = useSearchParams();
  const outcome = searchParams.get("outcome");

  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!paymentId) return;
    const reconcile = outcome === "cancelled" ? cancelPayment(paymentId) : confirmPayment(paymentId);
    reconcile
      .then(setPayment)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not check this payment's status."))
      .finally(() => setIsLoading(false));
  }, [paymentId, outcome]);

  if (isLoading) return <PageSpinner label="Confirming your payment…" />;

  const isSuccess = payment?.status === "COMPLETED";
  const isPending = payment?.status === "PENDING";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-neutral px-4 py-12">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 text-center">
          <div
            className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${
              isSuccess ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
            }`}
          >
            {isSuccess ? <CheckIcon className="h-6 w-6" /> : <AlertIcon className="h-6 w-6" />}
          </div>
          <h1 className="font-heading text-xl font-semibold text-primary">
            {isSuccess ? "Payment successful" : isPending ? "Payment pending" : "Payment not completed"}
          </h1>
          <p className="text-sm text-slate-500">
            {error
              ? error
              : isSuccess && payment
                ? `Your contribution of ${formatCurrency(payment.amount)} has been confirmed.`
                : isPending
                  ? "We're still waiting for confirmation from the payment provider. This can take a moment — check My Joins shortly."
                  : "This payment was cancelled or could not be completed. No charge was made."}
          </p>
          <LinkButton to="/retailer/joins" className="w-full">
            Go to My Joins
          </LinkButton>
        </CardContent>
      </Card>
    </div>
  );
}
