import { Link } from "react-router-dom";
import { LinkButton } from "@/components/ui/LinkButton";

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-neutral px-4 text-center">
      <p className="font-heading text-6xl font-bold text-primary">404</p>
      <p className="text-slate-500">This page doesn't exist or you don't have access to it.</p>
      <LinkButton to="/">Go home</LinkButton>
      <Link to="/login" className="text-sm text-tertiary hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}
