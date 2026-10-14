import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NOTIFICATIONS_POLL_MS,
  NotificationsProvider,
  useNotifications,
} from "@/context/NotificationsContext";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/services/api";
import type { AppNotification } from "@/types/domain";
import { authValue, makeUser } from "../fixtures/auth";

vi.mock("@/context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/services/api", () => ({
  listNotifications: vi.fn(),
  getUnreadNotificationCount: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

const mockedApi = vi.mocked(api);

function notification(id: string, isRead = false): AppNotification {
  return {
    _id: id,
    recipients: [{ user_ref: "user-1", isRead, readAt: null }],
    type: "PAYMENT_COMPLETED",
    title: `title ${id}`,
    message: "m",
    resource: { type: "POOL", id: "pool-1" },
    priority: "NORMAL",
    createdAt: "2026-10-14T00:00:00.000Z",
    updatedAt: "2026-10-14T00:00:00.000Z",
  };
}

// Shows the store as text and exposes its actions as buttons, so the tests
// drive it the way the bell and the page do. `name` tells two consumers
// apart.
function Probe({ name }: { name: string }) {
  const { notifications, unreadCount, isRead, markRead, markAllRead, openNotification } = useNotifications();
  return (
    <div>
      <p data-testid={`${name}-count`}>{unreadCount}</p>
      <ul>
        {notifications.map((n) => (
          <li key={n._id} data-testid={`${name}-${n._id}`}>
            {isRead(n) ? "read" : "unread"}
          </li>
        ))}
      </ul>
      <button onClick={() => markRead("n1")}>{name} read n1</button>
      <button onClick={() => markAllRead()}>{name} read all</button>
      {notifications.map((n) => (
        <button key={n._id} onClick={() => openNotification(n)}>
          {name} open {n._id}
        </button>
      ))}
    </div>
  );
}

function Location() {
  const { pathname, search } = useLocation();
  return <p data-testid="location">{pathname + search}</p>;
}

async function renderStore(panel: "retailer" | "supplier" | "admin" = "retailer") {
  render(
    <MemoryRouter initialEntries={[`/${panel}/notifications`]}>
      <NotificationsProvider panel={panel}>
        <Probe name="bell" />
        <Probe name="page" />
        <Location />
      </NotificationsProvider>
    </MemoryRouter>,
  );
  // The first load.
  await act(async () => {});
}

async function click(name: string) {
  await act(async () => {
    screen.getByRole("button", { name }).click();
  });
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
}

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue(authValue(makeUser()));
  mockedApi.listNotifications.mockResolvedValue([notification("n1"), notification("n2")]);
  mockedApi.getUnreadNotificationCount.mockResolvedValue(2);
  mockedApi.markNotificationRead.mockResolvedValue(notification("n1", true));
  mockedApi.markAllNotificationsRead.mockResolvedValue();
});

afterEach(() => {
  vi.useRealTimers();
  setVisibility("visible");
});

describe("NotificationsProvider", () => {
  it("loads the inbox and takes the badge count from the server", async () => {
    // More unread than the list holds: the badge still says how many.
    mockedApi.getUnreadNotificationCount.mockResolvedValue(7);

    await renderStore();

    expect(screen.getByTestId("bell-count")).toHaveTextContent("7");
    expect(screen.getByTestId("bell-n1")).toHaveTextContent("unread");
  });

  it("marks one read everywhere at once, then tells the server", async () => {
    await renderStore();

    await click("page read n1");

    // The bell sees what the page did: one store, not one per component.
    expect(screen.getByTestId("bell-n1")).toHaveTextContent("read");
    expect(screen.getByTestId("bell-n2")).toHaveTextContent("unread");
    expect(screen.getByTestId("bell-count")).toHaveTextContent("1");
    expect(mockedApi.markNotificationRead).toHaveBeenCalledWith("n1");
  });

  it("doesn't call the server again for one already read", async () => {
    mockedApi.listNotifications.mockResolvedValue([notification("n1", true)]);
    mockedApi.getUnreadNotificationCount.mockResolvedValue(0);
    await renderStore();

    await click("bell read n1");

    expect(mockedApi.markNotificationRead).not.toHaveBeenCalled();
    expect(screen.getByTestId("bell-count")).toHaveTextContent("0");
  });

  it("re-reads the inbox when marking read fails", async () => {
    mockedApi.markNotificationRead.mockRejectedValue(new Error("offline"));
    await renderStore();
    mockedApi.listNotifications.mockClear();

    await click("bell read n1");

    expect(mockedApi.listNotifications).toHaveBeenCalledTimes(1);
    // The server still says unread, so it shows unread again.
    expect(screen.getByTestId("bell-n1")).toHaveTextContent("unread");
    expect(screen.getByTestId("bell-count")).toHaveTextContent("2");
  });

  it("marks all read in one call, not one per notification", async () => {
    await renderStore();

    await click("bell read all");

    expect(mockedApi.markAllNotificationsRead).toHaveBeenCalledTimes(1);
    expect(mockedApi.markNotificationRead).not.toHaveBeenCalled();
    expect(screen.getByTestId("page-n1")).toHaveTextContent("read");
    expect(screen.getByTestId("page-n2")).toHaveTextContent("read");
    expect(screen.getByTestId("page-count")).toHaveTextContent("0");
  });
});

describe("NotificationsProvider openNotification", () => {
  it("marks it read and opens its page in this panel", async () => {
    await renderStore("retailer");

    await click("bell open n1");

    expect(screen.getByTestId("location")).toHaveTextContent("/retailer/joins?pool=pool-1");
    expect(mockedApi.markNotificationRead).toHaveBeenCalledWith("n1");
    expect(screen.getByTestId("page-n1")).toHaveTextContent("read");
  });

  it("only marks it read when it has nothing to open in this panel", async () => {
    // A payment notification has no supplier-panel page.
    await renderStore("supplier");

    await click("bell open n1");

    expect(screen.getByTestId("location")).toHaveTextContent("/supplier/notifications");
    expect(mockedApi.markNotificationRead).toHaveBeenCalledWith("n1");
  });

  it("still opens the page when saving the read fails", async () => {
    mockedApi.markNotificationRead.mockRejectedValue(new Error("offline"));
    await renderStore("retailer");

    await click("bell open n1");

    expect(screen.getByTestId("location")).toHaveTextContent("/retailer/joins?pool=pool-1");
  });
});

describe("NotificationsProvider polling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  async function tick() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(NOTIFICATIONS_POLL_MS);
    });
  }

  it("re-reads the inbox when the unread count changed", async () => {
    await renderStore();
    mockedApi.listNotifications.mockClear();
    mockedApi.listNotifications.mockResolvedValue([notification("n3"), notification("n1"), notification("n2")]);
    mockedApi.getUnreadNotificationCount.mockResolvedValue(3);

    await tick();

    expect(mockedApi.listNotifications).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("bell-n3")).toHaveTextContent("unread");
    expect(screen.getByTestId("bell-count")).toHaveTextContent("3");
  });

  it("only checks the count when nothing changed", async () => {
    await renderStore();
    mockedApi.listNotifications.mockClear();
    mockedApi.getUnreadNotificationCount.mockClear();

    await tick();

    expect(mockedApi.getUnreadNotificationCount).toHaveBeenCalledTimes(1);
    expect(mockedApi.listNotifications).not.toHaveBeenCalled();
  });

  it("doesn't check while the tab is hidden, and checks when it's shown again", async () => {
    await renderStore();
    mockedApi.getUnreadNotificationCount.mockClear();
    setVisibility("hidden");

    await tick();
    expect(mockedApi.getUnreadNotificationCount).not.toHaveBeenCalled();

    setVisibility("visible");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(mockedApi.getUnreadNotificationCount).toHaveBeenCalledTimes(1);
  });

  it("checks when the window regains focus", async () => {
    await renderStore();
    mockedApi.getUnreadNotificationCount.mockClear();

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(mockedApi.getUnreadNotificationCount).toHaveBeenCalledTimes(1);
  });
});
