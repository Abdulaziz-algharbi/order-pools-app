import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { PageSpinner } from "@/components/ui/Spinner";

export function RootRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <PageSpinner />;
  return <Navigate to={user ? `/${user.role}` : "/login"} replace />;
}
