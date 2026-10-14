import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { Panel } from "@/lib/panel";
import { notificationTarget } from "@/lib/notification-target";
import type { AppNotification } from "@/types/domain";
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/api";

/** How often the unread count is checked while the tab is visible. */
export const NOTIFICATIONS_POLL_MS = 30_000;

interface NotificationsContextValue {
  notifications: AppNotification[];
  isLoading: boolean;
  /** From the server (GET /notifications/unread-count), so the badge is
   *  right even for notifications the list hasn't loaded. */
  unreadCount: number;
  isRead: (notification: AppNotification) => boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  /** A click on a notification: marks it read and opens its page in this
   *  panel, if it has one (see lib/notification-target.ts). */
  openNotification: (notification: AppNotification) => void;
  refresh: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

/**
 * One inbox per panel, shared by everything in it — the Topbar's bell, the
 * notifications page and the dashboards — so marking one read anywhere
 * updates the rest. Mounted inside AppShell, which is keyed by panel, so a
 * panel switch starts a fresh inbox for that panel (the API scopes every
 * call to it, see panelScope() in services/api.ts).
 *
 * Kept current by checking the unread count every NOTIFICATIONS_POLL_MS
 * while the tab is visible, and when the tab or window regains focus; the
 * list is only re-read when that count changed.
 */
export function NotificationsProvider({ panel, children }: { panel: Panel; children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?._id;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  // The count as of the last read, for the poll to compare against without
  // restarting its timer on every change.
  const unreadCountRef = useRef(0);

  const applyCount = useCallback((count: number) => {
    unreadCountRef.current = count;
    setUnreadCount(count);
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const [list, count] = await Promise.all([listNotifications(), getUnreadNotificationCount()]);
      setNotifications(list);
      applyCount(count);
    } catch {
      // Keep what's shown; the next poll tries again.
    } finally {
      setIsLoading(false);
    }
  }, [userId, applyCount]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId) return;

    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const count = await getUnreadNotificationCount();
        if (count !== unreadCountRef.current) await refresh();
      } catch {
        // A missed check is retried on the next tick.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };

    const timer = window.setInterval(() => void check(), NOTIFICATIONS_POLL_MS);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, refresh]);

  const isRead = useCallback(
    (n: AppNotification) => n.recipients.find((r) => r.user_ref === userId)?.isRead ?? false,
    [userId],
  );

  const markLocally = useCallback(
    (shouldMark: (n: AppNotification) => boolean) =>
      setNotifications((prev) =>
        prev.map((n) =>
          shouldMark(n)
            ? {
                ...n,
                recipients: n.recipients.map((r) => (r.user_ref === userId ? { ...r, isRead: true } : r)),
              }
            : n,
        ),
      ),
    [userId],
  );

  // Both update what's shown first for a snappy UI, then re-read from the
  // server if the call fails rather than hand-reverting just what changed.
  const markRead = useCallback(
    async (id: string) => {
      const target = notifications.find((n) => n._id === id);
      if (!target || isRead(target)) return;
      markLocally((n) => n._id === id);
      applyCount(Math.max(0, unreadCountRef.current - 1));
      try {
        await markNotificationRead(id);
      } catch {
        await refresh();
      }
    },
    [notifications, isRead, markLocally, applyCount, refresh],
  );

  const markAllRead = useCallback(async () => {
    markLocally(() => true);
    applyCount(0);
    try {
      await markAllNotificationsRead();
    } catch {
      await refresh();
    }
  }, [markLocally, applyCount, refresh]);

  // Navigates without waiting for the read to be saved: a slow or failed
  // PATCH must never keep the user from the page (markRead re-syncs on
  // failure).
  const openNotification = useCallback(
    (n: AppNotification) => {
      void markRead(n._id);
      const to = notificationTarget(n, panel);
      if (to) navigate(to);
    },
    [markRead, panel, navigate],
  );

  const value = useMemo(
    () => ({ notifications, isLoading, unreadCount, isRead, markRead, markAllRead, openNotification, refresh }),
    [notifications, isLoading, unreadCount, isRead, markRead, markAllRead, openNotification, refresh],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within a NotificationsProvider");
  return ctx;
}
