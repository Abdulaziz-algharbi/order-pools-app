import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { PageSpinner } from "@/components/ui/Spinner";
import { defaultPanelFor } from "@/lib/panel";

export function RootRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <PageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  const panel = defaultPanelFor(user);
  return <Navigate to={panel ? `/${panel}` : "/login"} replace />;
}
