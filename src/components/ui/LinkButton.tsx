import { Link, type LinkProps } from "react-router-dom";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";

interface LinkButtonProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

export function LinkButton({ variant = "primary", size = "md", className, ...props }: LinkButtonProps) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />;
}
