import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AppUser } from "@/types/domain";
import {
  fetchCurrentUser,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  removeAccount as apiRemoveAccount,
  updateMyProfile,
  type RegisterInput,
  type UpdateProfileInput,
} from "@/services/api";

interface AuthContextValue {
  user: AppUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  /** Re-reads the signed-in account from `/auth/me` — for when its roles
   *  may have changed server-side mid-session (e.g. an approved supplier
   *  request). The backend re-issues the session cookies in the same call
   *  when the token's roles are stale, so API access follows along. */
  refreshUser: () => Promise<AppUser>;
  updateProfile: (patch: UpdateProfileInput) => Promise<AppUser>;
  /** Returns whether the account was actually deleted (RETAILER) vs. a
   *  removal request was filed instead (SUPPLIER) — see removeAccount()
   *  in services/api.ts. Clears the session locally only when deleted. */
  removeAccount: (reason: string) => Promise<{ deleted: boolean }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // No client-visible token to check first (httpOnly cookie) — just
    // attempt /auth/me and treat a 401 as "logged out", same as any other
    // unauthenticated result rather than an error to surface.
    fetchCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  // A background request whose silent-refresh attempt also failed (see
  // lib/http.ts) — the session is over even though nothing on this page
  // triggered it directly, so drop the user back to a logged-out state.
  useEffect(() => {
    const handleSessionExpired = () => setUser(null);
    window.addEventListener("order-pool:session-expired", handleSessionExpired);
    return () =>
      window.removeEventListener("order-pool:session-expired", handleSessionExpired);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    // Cookies are set by the browser from the response's Set-Cookie
    // headers — nothing to store locally.
    await apiLogin(email, password);
    const me = await fetchCurrentUser();
    setUser(me);
  }, []);

  const signup = useCallback(async (input: RegisterInput) => {
    await apiRegister(input);
    const me = await fetchCurrentUser();
    setUser(me);
  }, []);

  const logout = useCallback(() => {
    apiLogout().catch(() => {
      // Best-effort — reflect signed-out state locally regardless; the
      // backend clears its cookies on success, and a stale cookie left
      // behind by a failed call is harmless (it just fails auth next use).
    });
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await fetchCurrentUser();
    setUser(me);
    return me;
  }, []);

  const updateProfile = useCallback(async (patch: UpdateProfileInput) => {
    const updated = await updateMyProfile(patch);
    setUser(updated);
    return updated;
  }, []);

  const removeAccount = useCallback(async (reason: string) => {
    const result = await apiRemoveAccount(reason);
    if (result.deleted) {
      setUser(null);
    }
    return result;
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, signup, logout, refreshUser, updateProfile, removeAccount }),
    [user, isLoading, login, signup, logout, refreshUser, updateProfile, removeAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
