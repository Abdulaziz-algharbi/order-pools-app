import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { PageSpinner } from "@/components/ui/Spinner";
import type { UserRole } from "@/types/domain";
import { AppShell } from "@/components/layout/AppShell";

export function ProtectedRoute({ role }: { role: UserRole }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <PageSpinner label="Loading your workspace…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={`/${user.role}`} replace />;

  return <AppShell role={role} />;
}
