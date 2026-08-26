import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { NotificationItem } from "@/components/domain/NotificationItem";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { BellIcon } from "@/components/ui/icons";
import type { AppNotification } from "@/types/domain";

export function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notifications, isLoading, unreadCount, markRead, markAllRead } = useNotifications(user?.id);

  const handleClick = (n: AppNotification) => {
    markRead(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Updates about your pools, offers, and deliveries."
        action={
          unreadCount > 0 ? (
            <Button variant="outline" size="sm" onClick={() => markAllRead()}>
              Mark all read
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState icon={<BellIcon className="h-8 w-8" />} title="No notifications" description="You're all caught up." />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="divide-y divide-slate-100">
            {notifications.map((n) => (
              <NotificationItem key={n.id} notification={n} onClick={handleClick} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
