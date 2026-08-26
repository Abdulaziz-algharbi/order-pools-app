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
import { findUserById } from "@/mocks/api";

const STORAGE_KEY = "order-pool.session-user-id";

interface AuthContextValue {
  user: AppUser | null;
  isLoading: boolean;
  loginAs: (userId: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedId = localStorage.getItem(STORAGE_KEY);
    if (!storedId) {
      setIsLoading(false);
      return;
    }
    findUserById(storedId).then((found) => {
      setUser(found ?? null);
      setIsLoading(false);
    });
  }, []);

  const loginAs = useCallback(async (userId: string) => {
    const found = await findUserById(userId);
    if (!found) throw new Error("Account not found");
    localStorage.setItem(STORAGE_KEY, found.id);
    setUser(found);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, loginAs, logout }),
    [user, isLoading, loginAs, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
