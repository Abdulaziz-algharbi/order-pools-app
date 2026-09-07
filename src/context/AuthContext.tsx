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
import { fetchCurrentUser, login as apiLogin, logout as apiLogout } from "@/mocks/api";

interface AuthContextValue {
  user: AppUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
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

  const logout = useCallback(() => {
    apiLogout().catch(() => {
      // Best-effort — the tokens are cleared locally regardless.
    });
    clearTokens();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, logout }),
    [user, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
