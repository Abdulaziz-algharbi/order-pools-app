import type { AppNotification } from "@/types/domain";
import { formatRelativeTime, cn } from "@/lib/utils";

const ICONS: Record<AppNotification["type"], string> = {
  DELIVERY_ASSIGNED: "🚚",
  PAYMENT_COMPLETED: "✅",
  PAYMENT_FAILED: "⚠️",
  PAYMENT_REFUNDED: "↩️",
};

interface NotificationItemProps {
  notification: AppNotification;
  isRead: boolean;
  onClick?: (notification: AppNotification) => void;
}

export function NotificationItem({ notification, isRead, onClick }: NotificationItemProps) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(notification)}
      className={cn(
        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50",
        !isRead && "bg-tertiary/5",
      )}
    >
      <span className="mt-0.5 text-lg leading-none" aria-hidden="true">
        {ICONS[notification.type]}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-primary">{notification.title}</p>
          {!isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />}
        </div>
        <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{notification.message}</p>
        <p className="mt-1 text-xs text-slate-400">{formatRelativeTime(notification.createdAt)}</p>
      </div>
    </button>
  );
}
