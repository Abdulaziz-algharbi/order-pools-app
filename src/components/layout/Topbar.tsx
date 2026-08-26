import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationItem } from "@/components/domain/NotificationItem";
import { EmptyState } from "@/components/ui/EmptyState";
import { BellIcon, ChevronDownIcon, LogOutIcon, MenuIcon, UserIcon } from "@/components/ui/icons";
import type { AppNotification, UserRole } from "@/types/domain";
import { cn } from "@/lib/utils";

const NOTIFICATIONS_PAGE: Partial<Record<UserRole, string>> = {
  retailer: "/retailer/notifications",
  supplier: "/supplier/notifications",
};

function useClickOutside(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onOutside]);
  return ref;
}

export function Topbar({ onMenuClick, title }: { onMenuClick: () => void; title: string }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notifRef = useClickOutside(() => setNotifOpen(false));
  const profileRef = useClickOutside(() => setProfileOpen(false));

  const { notifications, unreadCount, markRead, markAllRead } = useNotifications(user?.id);

  const displayName = user?.role === "supplier" ? user.companyName : user?.role === "retailer" ? user.businessName : user?.name;

  const handleNotificationClick = (n: AppNotification) => {
    markRead(n.id);
    setNotifOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          aria-label="Open navigation menu"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
        <h1 className="font-heading text-lg font-semibold text-primary">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifOpen((o) => !o)}
            className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Notifications"
          >
            <BellIcon className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 z-20 mt-2 max-h-[28rem] w-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <p className="font-heading text-sm font-semibold text-primary">Notifications</p>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllRead()}
                    className="text-xs font-medium text-tertiary hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <EmptyState title="No notifications" description="You're all caught up." className="border-0 py-10" />
              ) : (
                <div className="divide-y divide-slate-100">
                  {notifications.slice(0, 8).map((n) => (
                    <NotificationItem key={n.id} notification={n} onClick={handleNotificationClick} />
                  ))}
                </div>
              )}
              {user && NOTIFICATIONS_PAGE[user.role] && (
                <button
                  type="button"
                  onClick={() => {
                    navigate(NOTIFICATIONS_PAGE[user.role]!);
                    setNotifOpen(false);
                  }}
                  className="block w-full border-t border-slate-100 py-2.5 text-center text-sm font-medium text-tertiary hover:bg-slate-50"
                >
                  View all
                </button>
              )}
            </div>
          )}
        </div>

        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-tertiary/10 text-tertiary">
              <UserIcon className="h-4.5 w-4.5" />
            </div>
            <span className="hidden max-w-[10rem] truncate text-sm font-medium text-primary sm:block">
              {displayName}
            </span>
            <ChevronDownIcon className="hidden h-4 w-4 text-slate-400 sm:block" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  navigate(`/${user?.role}/profile`);
                  setProfileOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-4 py-2 text-sm text-primary hover:bg-slate-50",
                  user?.role === "admin" && "hidden",
                )}
              >
                <UserIcon className="h-4 w-4" /> Profile
              </button>
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOutIcon className="h-4 w-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
