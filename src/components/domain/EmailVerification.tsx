import { useAuth } from "@/context/AuthContext";
import { useResendVerification } from "@/hooks/useResendVerification";
import { Button } from "@/components/ui/Button";
import { AlertIcon } from "@/components/ui/icons";

/**
 * Shown at the top of every panel while the signed-in account's email is
 * unverified. Browsing and account management stay available; joining
 * pools, requesting supplier access and creating offers don't (the backend
 * refuses them — see requireVerifiedEmail).
 */
export function EmailVerificationBanner() {
  const { user } = useAuth();
  const { resend, state } = useResendVerification();

  if (!user || user.isVerified) return null;

  return (
    <div role="status" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
      <div className="flex flex-wrap items-start gap-3">
        <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-amber-900">Please verify your email address</p>
          <p className="mt-1 text-amber-800">
            We sent a verification link to <span className="font-medium">{user.email}</span>. Until you verify, you
            can browse pools and manage your account, but you can't join pools, request supplier access or create
            offers.
          </p>
          {state.status === "sent" && <p className="mt-2 text-emerald-700">{state.message}</p>}
          {state.status === "error" && <p className="mt-2 text-red-700">{state.message}</p>}
        </div>
        <Button size="sm" variant="outline" onClick={resend} isLoading={state.status === "sending"}>
          Resend verification email
        </Button>
      </div>
    </div>
  );
}

/** Inline explanation next to an action the backend refuses until the email is verified. */
export function EmailVerificationRequired({ action }: { action: string }) {
  return (
    <p className="text-sm text-amber-700">
      Verify your email address to {action}. Use the link we emailed you, or resend it from the notice at the top
      of the page.
    </p>
  );
}
