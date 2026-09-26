import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { PageSpinner } from "@/components/ui/Spinner";
import type { Panel } from "@/lib/panel";
import { defaultPanelFor, rememberPanel, userHasPanel } from "@/lib/panel";
import { AppShell } from "@/components/layout/AppShell";

export function ProtectedRoute({ role }: { role: Panel }) {
  const { user, isLoading } = useAuth();
  const allowed = !!user && userHasPanel(user, role);

  // Opening a panel (by switching, a link, or typing the URL) makes it the
  // one this user lands in on their next login.
  useEffect(() => {
    if (user && allowed) rememberPanel(user._id, role);
  }, [user, allowed, role]);

  if (isLoading) return <PageSpinner label="Loading your workspace…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (!allowed) {
    const fallback = defaultPanelFor(user);
    return <Navigate to={fallback ? `/${fallback}` : "/login"} replace />;
  }

  // Keyed by panel: /retailer and /supplier render this same component
  // at the same spot, so without a key React would keep one AppShell
  // across a switch and its panel-scoped state (the Topbar's
  // notifications) would never refetch for the new panel.
  return <AppShell key={role} role={role} />;
}
