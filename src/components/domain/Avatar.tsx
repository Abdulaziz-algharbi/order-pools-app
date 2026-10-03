import { cldUrl } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import type { AppUser } from "@/types/domain";

const SIZES = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-20 w-20 text-2xl",
} as const;

interface AvatarProps {
  user: Pick<AppUser, "firstName" | "lastName" | "profileImage">;
  size?: keyof typeof SIZES;
  className?: string;
  /** Hidden from screen readers — for where the name is already shown next to it. */
  decorative?: boolean;
}

function initials({ firstName, lastName }: Pick<AppUser, "firstName" | "lastName">): string {
  return `${firstName.trim()[0] ?? ""}${lastName.trim()[0] ?? ""}`.toUpperCase() || "?";
}

/** A user's profile photo, or their initials when they haven't set one. */
export function Avatar({ user, size = "md", className, decorative }: AvatarProps) {
  const name = `${user.firstName} ${user.lastName}`.trim();
  const base = cn("shrink-0 overflow-hidden rounded-full", SIZES[size], className);

  if (user.profileImage) {
    return (
      <img
        src={cldUrl(user.profileImage, "avatar")}
        alt={decorative ? "" : name}
        className={cn(base, "object-cover")}
      />
    );
  }
  return (
    <span
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": name })}
      className={cn(base, "flex items-center justify-center bg-tertiary/10 font-heading font-semibold text-tertiary")}
    >
      {initials(user)}
    </span>
  );
}
