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
import { getAccessToken, clearTokens, setTokens } from "@/lib/tokenStore";
import {
  fetchCurrentUser,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  removeAccount as apiRemoveAccount,
  updateMyProfile,
  type RegisterInput,
  type UpdateProfileInput,
} from "@/mocks/api";

interface AuthContextValue {
  user: AppUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  updateProfile: (patch: UpdateProfileInput) => Promise<AppUser>;
  /** Returns whether the account was actually deleted (RETAILER) vs. a
   *  removal request was filed instead (SUPPLIER) — see removeAccount()
   *  in mocks/api.ts. Clears the session locally only when deleted. */
  removeAccount: (reason: string) => Promise<{ deleted: boolean }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!getAccessToken()) {
      setIsLoading(false);
      return;
    }
    fetchCurrentUser()
      .then(setUser)
      .catch(() => {
        clearTokens();
        setUser(null);
      })
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
    const { accessToken, refreshToken } = await apiLogin(email, password);
    setTokens(accessToken, refreshToken);
    const me = await fetchCurrentUser();
    setUser(me);
  }, []);

  const signup = useCallback(async (input: RegisterInput) => {
    const { accessToken, refreshToken } = await apiRegister(input);
    setTokens(accessToken, refreshToken);
    const me = await fetchCurrentUser();
    setUser(me);
  }, []);

  const logout = useCallback(() => {
    apiLogout().catch(() => {
      // Best-effort — the tokens are cleared locally regardless.
    });
    clearTokens();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (patch: UpdateProfileInput) => {
    const updated = await updateMyProfile(patch);
    setUser(updated);
    return updated;
  }, []);

  const removeAccount = useCallback(async (reason: string) => {
    const result = await apiRemoveAccount(reason);
    if (result.deleted) {
      clearTokens();
      setUser(null);
    }
    return result;
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, signup, logout, updateProfile, removeAccount }),
    [user, isLoading, login, signup, logout, updateProfile, removeAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
