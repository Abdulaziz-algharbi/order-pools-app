import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getDemoAccounts } from "@/mocks/api";
import type { AppUser, UserRole } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { FieldWrapper, Input } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { BuildingIcon, PackageIcon, UserIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

const ROLE_META: Record<UserRole, { label: string; icon: typeof UserIcon; description: string }> = {
  retailer: { label: "Retailer", icon: UserIcon, description: "Browse pools & join purchases" },
  supplier: { label: "Supplier", icon: PackageIcon, description: "Submit offers & fulfill pools" },
  admin: { label: "Administrator", icon: BuildingIcon, description: "Manage the platform" },
};

function displayName(u: AppUser): string {
  return u.role === "supplier" ? u.companyName : u.role === "retailer" ? u.businessName : u.name;
}

export function LoginPage() {
  const { user, loginAs, isLoading } = useAuth();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<AppUser[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDemoAccounts()
      .then(setAccounts)
      .finally(() => setAccountsLoading(false));
  }, []);

  if (!isLoading && user) {
    return <Navigate to={`/${user.role}`} replace />;
  }

  const handleQuickLogin = async (id: string) => {
    setError(null);
    setPendingId(id);
    try {
      await loginAs(id);
      const account = accounts.find((a) => a.id === id);
      if (account) navigate(`/${account.role}`);
    } catch {
      setError("Could not sign in with this account. Please try again.");
    } finally {
      setPendingId(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const match = accounts.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
    if (!match) {
      setError("No account found with that email. Try one of the demo accounts below.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }
    await handleQuickLogin(match.id);
  };

  const grouped: Record<UserRole, AppUser[]> = { retailer: [], supplier: [], admin: [] };
  accounts.forEach((a) => grouped[a.role].push(a));

  return (
    <div className="flex min-h-dvh items-center justify-center bg-primary px-4 py-12">
      <div className="w-full max-w-4xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-lg font-bold text-white">
            OP
          </div>
          <h1 className="font-heading text-2xl font-semibold text-white">Order Pool</h1>
          <p className="mt-1 text-sm text-slate-400">Wholesale group purchasing, made accessible.</p>
        </div>

        <div className="grid gap-6 rounded-2xl bg-white p-6 shadow-xl sm:p-8 lg:grid-cols-2">
          <div>
            <h2 className="font-heading text-lg font-semibold text-primary">Sign in</h2>
            <p className="mt-1 text-sm text-slate-500">
              Enter your account email and password.
            </p>
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <FieldWrapper label="Email" htmlFor="email" required>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </FieldWrapper>
              <FieldWrapper label="Password" htmlFor="password" required>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </FieldWrapper>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" isLoading={pendingId !== null}>
                Sign in
              </Button>
            </form>
          </div>

          <div className="border-t border-slate-100 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <h2 className="font-heading text-lg font-semibold text-primary">Demo accounts</h2>
            <p className="mt-1 text-sm text-slate-500">
              No backend connected yet — pick an account to preview each role.
            </p>

            {accountsLoading ? (
              <div className="mt-6 flex justify-center">
                <Spinner />
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {(Object.keys(grouped) as UserRole[]).map((role) => (
                  <div key={role}>
                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {ROLE_META[role].label}
                    </p>
                    <div className="space-y-1.5">
                      {grouped[role].map((account) => {
                        const Icon = ROLE_META[role].icon;
                        return (
                          <button
                            key={account.id}
                            type="button"
                            onClick={() => handleQuickLogin(account.id)}
                            disabled={pendingId !== null}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-left transition-colors hover:border-tertiary hover:bg-tertiary/5 disabled:opacity-60",
                            )}
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-primary">
                                {displayName(account)}
                              </span>
                              <span className="block truncate text-xs text-slate-500">{account.email}</span>
                            </span>
                            {pendingId === account.id && <Spinner className="h-4 w-4" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
