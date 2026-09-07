import { useCallback, useEffect, useState } from "react";
import type { AppNotification } from "@/types/domain";
import { listNotifications, markNotificationRead } from "@/mocks/api";

// The backend redacts `recipients` down to just the caller's own entry for
// a non-admin caller, so this is safe to use for retailer/supplier; for an
// ADMIN caller (who sees every recipient) it looks up their own entry
// specifically, which is usually absent since admins are rarely notified.
function isReadForUser(n: AppNotification, userId: string): boolean {
  return n.recipients.find((r) => r.user_ref === userId)?.isRead ?? false;
}

export function useNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!userId) return;
    setIsLoading(true);
    listNotifications()
      .then(setNotifications)
      .finally(() => setIsLoading(false));
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const markRead = useCallback(
    async (id: string) => {
      setNotifications((prev) =>
        prev.map((n) =>
          n._id === id
            ? {
                ...n,
                recipients: n.recipients.map((r) =>
                  r.user_ref === userId ? { ...r, isRead: true } : r,
                ),
              }
            : n,
        ),
      );
      await markNotificationRead(id);
    },
    [userId],
  );

  // No bulk "mark all read" endpoint exists on the backend — each
  // notification's read state is its own PATCH, fired off together.
  const markAllRead = useCallback(async () => {
    if (!userId) return;
    const unreadIds = notifications
      .filter((n) => !isReadForUser(n, userId))
      .map((n) => n._id);
    setNotifications((prev) =>
      prev.map((n) => ({
        ...n,
        recipients: n.recipients.map((r) =>
          r.user_ref === userId ? { ...r, isRead: true } : r,
        ),
      })),
    );
    await Promise.all(unreadIds.map((id) => markNotificationRead(id)));
  }, [userId, notifications]);

  const unreadCount = userId
    ? notifications.filter((n) => !isReadForUser(n, userId)).length
    : 0;

  return {
    notifications,
    isLoading,
    unreadCount,
    markRead,
    markAllRead,
    refresh,
    isReadForUser: (n: AppNotification) =>
      userId ? isReadForUser(n, userId) : false,
  };
}
