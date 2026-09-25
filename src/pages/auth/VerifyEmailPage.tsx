import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useResendVerification } from "@/hooks/useResendVerification";
import { verifyEmail } from "@/services/api";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageSpinner } from "@/components/ui/Spinner";
import { AlertIcon, CheckIcon } from "@/components/ui/icons";
import { ApiError } from "@/lib/http";

type Outcome = { status: "verifying" } | { status: "verified" } | { status: "failed"; message: string };

/**
 * Landing page for the emailed link (/verify-email?token=…). Public: the
 * link may be opened signed out or on another device. The token is
 * submitted with a POST rather than being verified by the link itself, so
 * mail scanners that prefetch links can't consume it.
 */
export function VerifyEmailPage() {
  const { user, refreshUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  // Captured once — the token is removed from the address bar below so it
  // doesn't linger in history or get shared by copying the URL.
  const [token] = useState(() => searchParams.get("token"));
  const [outcome, setOutcome] = useState<Outcome>(() =>
    token ? { status: "verifying" } : { status: "failed", message: "This link is missing its verification token." },
  );
  // Links are single-use: a second submission (StrictMode re-running the
  // effect in development) would fail and overwrite the real result.
  const submitted = useRef(false);

  useEffect(() => {
    if (!token || submitted.current) return;
    submitted.current = true;
    setSearchParams({}, { replace: true });

    verifyEmail(token)
      .then(async () => {
        setOutcome({ status: "verified" });
        // Signed in on this browser? Drop the "verify your email" prompt.
        await refreshUser().catch(() => {});
      })
      .catch((e) =>
        setOutcome({
          status: "failed",
          message: e instanceof ApiError ? e.message : "Could not verify your email address.",
        }),
      );
  }, [token, setSearchParams, refreshUser]);

  if (outcome.status === "verifying") return <PageSpinner label="Verifying your email…" />;

  const verified = outcome.status === "verified";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-neutral px-4 py-12">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 text-center">
          <div
            className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${
              verified ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
            }`}
          >
            {verified ? <CheckIcon className="h-6 w-6" /> : <AlertIcon className="h-6 w-6" />}
          </div>
          <h1 className="font-heading text-xl font-semibold text-primary">
            {verified ? "Email verified" : "We couldn't verify your email"}
          </h1>
          <p className="text-sm text-slate-500">
            {verified
              ? "Your email address is confirmed. You can now join pools and use every feature of Order Pool."
              : outcome.message}
          </p>
          {verified ? (
            <LinkButton to="/" className="w-full">
              Continue
            </LinkButton>
          ) : user ? (
            <ResendLink />
          ) : (
            <LinkButton to="/login" className="w-full">
              Log in to request a new link
            </LinkButton>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ResendLink() {
  const { resend, state } = useResendVerification();
  return (
    <div className="space-y-2">
      <Button className="w-full" onClick={resend} isLoading={state.status === "sending"}>
        Send me a new link
      </Button>
      {state.status === "sent" && <p className="text-sm text-emerald-700">{state.message}</p>}
      {state.status === "error" && <p className="text-sm text-red-700">{state.message}</p>}
    </div>
  );
}
