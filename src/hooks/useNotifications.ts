import { useCallback, useEffect, useState } from "react";
import type { AppNotification } from "@/types/domain";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "@/mocks/api";

export function useNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!userId) return;
    setIsLoading(true);
    listNotifications(userId)
      .then(setNotifications)
      .finally(() => setIsLoading(false));
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await markNotificationRead(id);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await markAllNotificationsRead(userId);
  }, [userId]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, isLoading, unreadCount, markRead, markAllRead, refresh };
}
