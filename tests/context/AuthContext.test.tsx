import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import * as api from "@/services/api";
import type { AppUser } from "@/types/domain";

vi.mock("@/services/api", () => ({
  fetchCurrentUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  removeAccount: vi.fn(),
  updateMyProfile: vi.fn(),
}));

const mockedApi = vi.mocked(api);

const retailer: AppUser = {
  _id: "u1",
  firstName: "Aisha",
  lastName: "Said",
  email: "aisha@example.com",
  phoneNumber: "+96890000000",
  companyName: "Said Trading",
  roles: ["RETAILER"],
  addresses: [],
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const unauthorized = Object.assign(new Error("Access token is missing"), { status: 401 });

// Renders the context's state as text and exposes each action as a
// button, so the tests drive the provider the way a page would.
function Probe() {
  const auth = useAuth();
  return (
    <div>
      <p data-testid="status">
        {auth.isLoading ? "loading" : auth.user ? `signed-in:${auth.user.email}` : "signed-out"}
      </p>
      <button onClick={() => auth.login("aisha@example.com", "secret").catch(() => {})}>
        login
      </button>
      <button
        onClick={() =>
          auth
            .signup({
              firstName: "Aisha",
              lastName: "Said",
              email: "aisha@example.com",
              phoneNumber: "+96890000000",
              companyName: "Said Trading",
              password: "secret",
              addresses: ["a1"],
            })
            .catch(() => {})
        }
      >
        signup
      </button>
      <button onClick={auth.logout}>logout</button>
      <button onClick={() => auth.refreshUser().catch(() => {})}>refresh</button>
      <button onClick={() => auth.updateProfile({ firstName: "Ayesha" })}>update</button>
      <button onClick={() => auth.removeAccount("closing shop")}>remove</button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

const status = () => screen.getByTestId("status");

beforeEach(() => {
  vi.resetAllMocks();
  mockedApi.logout.mockResolvedValue(undefined);
});

describe("AuthProvider — session bootstrap", () => {
  it("restores the session from the auth cookie by calling /auth/me on mount", async () => {
    mockedApi.fetchCurrentUser.mockResolvedValue(retailer);

    renderWithProvider();

    expect(status()).toHaveTextContent("loading");
    await waitFor(() => expect(status()).toHaveTextContent("signed-in:aisha@example.com"));
    expect(mockedApi.fetchCurrentUser).toHaveBeenCalledTimes(1);
  });

  it("calls /auth/me even when localStorage holds no token — the cookie is invisible to JS", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    mockedApi.fetchCurrentUser.mockResolvedValue(retailer);

    renderWithProvider();

    await waitFor(() => expect(status()).toHaveTextContent("signed-in"));
    expect(getItem).not.toHaveBeenCalled();
  });

  it("treats a 401 from /auth/me as signed out rather than an error", async () => {
    mockedApi.fetchCurrentUser.mockRejectedValue(unauthorized);

    renderWithProvider();

    await waitFor(() => expect(status()).toHaveTextContent("signed-out"));
  });

  it("drops the user when lib/http signals that the session expired", async () => {
    mockedApi.fetchCurrentUser.mockResolvedValue(retailer);
    renderWithProvider();
    await waitFor(() => expect(status()).toHaveTextContent("signed-in"));

    act(() => {
      window.dispatchEvent(new Event("order-pool:session-expired"));
    });

    expect(status()).toHaveTextContent("signed-out");
  });
});

describe("AuthProvider — actions", () => {
  beforeEach(() => {
    mockedApi.fetchCurrentUser.mockRejectedValueOnce(unauthorized);
  });

  it("login relies on the Set-Cookie response, then loads the user from /auth/me", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    mockedApi.login.mockResolvedValue(undefined);
    mockedApi.fetchCurrentUser.mockResolvedValueOnce(retailer);
    renderWithProvider();
    await waitFor(() => expect(status()).toHaveTextContent("signed-out"));

    await userEvent.click(screen.getByRole("button", { name: "login" }));

    await waitFor(() => expect(status()).toHaveTextContent("signed-in:aisha@example.com"));
    expect(mockedApi.login).toHaveBeenCalledWith("aisha@example.com", "secret");
    expect(setItem).not.toHaveBeenCalled();
  });

  it("stays signed out when login fails", async () => {
    mockedApi.login.mockRejectedValue(new Error("Invalid email or password"));
    renderWithProvider();
    await waitFor(() => expect(status()).toHaveTextContent("signed-out"));

    await userEvent.click(screen.getByRole("button", { name: "login" }));

    expect(status()).toHaveTextContent("signed-out");
    expect(mockedApi.fetchCurrentUser).toHaveBeenCalledTimes(1);
  });

  it("signup registers, then loads the user from /auth/me", async () => {
    mockedApi.register.mockResolvedValue(undefined);
    mockedApi.fetchCurrentUser.mockResolvedValueOnce(retailer);
    renderWithProvider();
    await waitFor(() => expect(status()).toHaveTextContent("signed-out"));

    await userEvent.click(screen.getByRole("button", { name: "signup" }));

    await waitFor(() => expect(status()).toHaveTextContent("signed-in:aisha@example.com"));
    expect(mockedApi.register).toHaveBeenCalledWith(
      expect.objectContaining({ email: "aisha@example.com", addresses: ["a1"] }),
    );
  });

  it("logout calls the backend (which clears the cookies) and signs out locally", async () => {
    mockedApi.login.mockResolvedValue(undefined);
    mockedApi.fetchCurrentUser.mockResolvedValueOnce(retailer);
    renderWithProvider();
    await waitFor(() => expect(status()).toHaveTextContent("signed-out"));
    await userEvent.click(screen.getByRole("button", { name: "login" }));
    await waitFor(() => expect(status()).toHaveTextContent("signed-in"));

    await userEvent.click(screen.getByRole("button", { name: "logout" }));

    expect(mockedApi.logout).toHaveBeenCalledTimes(1);
    expect(status()).toHaveTextContent("signed-out");
  });

  it("logout still signs out locally when the backend call fails", async () => {
    mockedApi.logout.mockRejectedValue(new Error("Network Error"));
    mockedApi.login.mockResolvedValue(undefined);
    mockedApi.fetchCurrentUser.mockResolvedValueOnce(retailer);
    renderWithProvider();
    await waitFor(() => expect(status()).toHaveTextContent("signed-out"));
    await userEvent.click(screen.getByRole("button", { name: "login" }));
    await waitFor(() => expect(status()).toHaveTextContent("signed-in"));

    await userEvent.click(screen.getByRole("button", { name: "logout" }));

    expect(status()).toHaveTextContent("signed-out");
  });

  it("refreshUser re-reads /auth/me so a role granted mid-session is picked up", async () => {
    mockedApi.login.mockResolvedValue(undefined);
    mockedApi.fetchCurrentUser
      .mockResolvedValueOnce(retailer)
      .mockResolvedValueOnce({ ...retailer, email: "now-supplier@example.com", roles: ["RETAILER", "SUPPLIER"] });
    renderWithProvider();
    await waitFor(() => expect(status()).toHaveTextContent("signed-out"));
    await userEvent.click(screen.getByRole("button", { name: "login" }));
    await waitFor(() => expect(status()).toHaveTextContent("signed-in:aisha@example.com"));

    await userEvent.click(screen.getByRole("button", { name: "refresh" }));

    await waitFor(() => expect(status()).toHaveTextContent("signed-in:now-supplier@example.com"));
    expect(mockedApi.fetchCurrentUser).toHaveBeenCalledTimes(3);
  });

  it("updateProfile replaces the user with the backend's response", async () => {
    mockedApi.login.mockResolvedValue(undefined);
    mockedApi.fetchCurrentUser.mockResolvedValueOnce(retailer);
    mockedApi.updateMyProfile.mockResolvedValue({ ...retailer, email: "ayesha@example.com" });
    renderWithProvider();
    await waitFor(() => expect(status()).toHaveTextContent("signed-out"));
    await userEvent.click(screen.getByRole("button", { name: "login" }));
    await waitFor(() => expect(status()).toHaveTextContent("signed-in"));

    await userEvent.click(screen.getByRole("button", { name: "update" }));

    await waitFor(() => expect(status()).toHaveTextContent("signed-in:ayesha@example.com"));
    expect(mockedApi.updateMyProfile).toHaveBeenCalledWith({ firstName: "Ayesha" });
  });

  it.each([
    { deleted: true, expected: "signed-out" },
    { deleted: false, expected: "signed-in" },
  ])(
    "removeAccount signs out only when the account was actually deleted (deleted: $deleted)",
    async ({ deleted, expected }) => {
      mockedApi.login.mockResolvedValue(undefined);
      mockedApi.fetchCurrentUser.mockResolvedValueOnce(retailer);
      mockedApi.removeAccount.mockResolvedValue({ deleted });
      renderWithProvider();
      await waitFor(() => expect(status()).toHaveTextContent("signed-out"));
      await userEvent.click(screen.getByRole("button", { name: "login" }));
      await waitFor(() => expect(status()).toHaveTextContent("signed-in"));

      await userEvent.click(screen.getByRole("button", { name: "remove" }));

      await waitFor(() => expect(mockedApi.removeAccount).toHaveBeenCalledWith("closing shop"));
      await waitFor(() => expect(status()).toHaveTextContent(expected));
    },
  );
});

describe("useAuth", () => {
  it("throws outside an AuthProvider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow("useAuth must be used within an AuthProvider");
  });
});
