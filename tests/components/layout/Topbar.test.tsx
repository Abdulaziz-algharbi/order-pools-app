import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Topbar } from "@/components/layout/Topbar";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import type { Panel } from "@/lib/panel";
import type { AppUser } from "@/types/domain";
import { authValue, makeUser } from "../../fixtures/auth";

vi.mock("@/context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/useNotifications", () => ({ useNotifications: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseNotifications = vi.mocked(useNotifications);

function renderTopbar(role: Panel, user: Partial<AppUser> = {}) {
  mockedUseAuth.mockReturnValue(authValue(makeUser(user)));
  render(
    <MemoryRouter initialEntries={[`/${role}`]}>
      <Routes>
        <Route path={`/${role}`} element={<Topbar role={role} onMenuClick={() => {}} title="Dashboard" />} />
        <Route path={`/${role}/profile`} element={<p>profile page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const accountButton = () => screen.getByRole("button", { name: /Said Trading/ });

beforeEach(() => {
  vi.resetAllMocks();
  mockedUseNotifications.mockReturnValue({
    notifications: [],
    unreadCount: 0,
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    isReadForUser: () => true,
  } as unknown as ReturnType<typeof useNotifications>);
});

describe("Topbar account button", () => {
  it("shows the user's profile photo", () => {
    renderTopbar("retailer", { profileImage: { publicId: "orderpools/dev/profiles/user-1/me", version: 2 } });

    const photo = accountButton().querySelector("img");
    expect(photo).toHaveAttribute("src", expect.stringContaining("/v2/orderpools/dev/profiles/user-1/me"));
    // The name is right beside it, so the photo isn't announced again.
    expect(photo).toHaveAttribute("alt", "");
  });

  it("shows the user's initials without a photo", () => {
    renderTopbar("retailer", { profileImage: null });

    expect(accountButton()).toHaveTextContent("AS");
    // The initials are hidden from screen readers; the name says it.
    expect(accountButton()).toHaveAccessibleName("Said Trading");
  });

  // There's an admin profile now, so the menu links to it on every panel.
  it.each(["retailer", "supplier", "admin"] as const)("links to the %s profile from the menu", async (role) => {
    renderTopbar(role, { roles: ["RETAILER", "SUPPLIER", "ADMIN"] });

    await userEvent.click(accountButton());
    await userEvent.click(screen.getByRole("button", { name: "Profile" }));

    expect(screen.getByText("profile page")).toBeInTheDocument();
  });
});
