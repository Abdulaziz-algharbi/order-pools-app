import { useCallback, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { resendVerificationEmail } from "@/services/api";
import { ApiError } from "@/lib/http";

type ResendState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "sent"; message: string }
  | { status: "error"; message: string };

/**
 * Shared by the verification banner and the verify-email page. Surfaces
 * the backend's own message for every outcome (e.g. its resend cooldown).
 * A 409 means the account was verified elsewhere (another tab or device)
 * since this page loaded, so the user is re-read to drop the stale prompt.
 */
export function useResendVerification() {
  const { refreshUser } = useAuth();
  const [state, setState] = useState<ResendState>({ status: "idle" });

  const resend = useCallback(async () => {
    setState({ status: "sending" });
    try {
      const message = await resendVerificationEmail();
      setState({ status: "sent", message });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        await refreshUser().catch(() => {});
      }
      setState({
        status: "error",
        message: e instanceof ApiError ? e.message : "Could not send the verification email.",
      });
    }
  }, [refreshUser]);

  return { resend, state };
}
