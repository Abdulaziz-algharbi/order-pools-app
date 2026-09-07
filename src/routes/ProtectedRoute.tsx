import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { PageSpinner } from "@/components/ui/Spinner";
import type { Panel } from "@/lib/panel";
import { defaultPanelFor, userHasPanel } from "@/lib/panel";
import { AppShell } from "@/components/layout/AppShell";

export function ProtectedRoute({ role }: { role: Panel }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <PageSpinner label="Loading your workspace…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (!userHasPanel(user, role)) {
    const fallback = defaultPanelFor(user);
    return <Navigate to={fallback ? `/${fallback}` : "/login"} replace />;
  }

  return <AppShell role={role} />;
}
