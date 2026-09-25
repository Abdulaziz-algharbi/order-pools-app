import { StrictMode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VerifyEmailPage } from "@/pages/auth/VerifyEmailPage";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/services/api";
import { ApiError } from "@/lib/http";
import { authValue, makeUser } from "../../fixtures/auth";

vi.mock("@/context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/services/api", () => ({
  verifyEmail: vi.fn(),
  resendVerificationEmail: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedApi = vi.mocked(api);
const refreshUser = vi.fn();

function renderAt(url: string) {
  const router = createMemoryRouter(
    [
      { path: "/verify-email", element: <VerifyEmailPage /> },
      { path: "/", element: <p>Home</p> },
      { path: "/login", element: <p>Login page</p> },
    ],
    { initialEntries: [url] },
  );
  // StrictMode on purpose: it runs effects twice in development, and a
  // single-use link must still only be submitted once.
  render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
  return router;
}

beforeEach(() => {
  vi.resetAllMocks();
  refreshUser.mockResolvedValue(makeUser());
  mockedUseAuth.mockReturnValue(authValue(null, { refreshUser }));
});

describe("VerifyEmailPage", () => {
  it("submits the token exactly once and removes it from the address bar", async () => {
    mockedApi.verifyEmail.mockResolvedValue(undefined);

    const router = renderAt("/verify-email?token=abc123");

    expect(await screen.findByText("Email verified")).toBeInTheDocument();
    expect(mockedApi.verifyEmail).toHaveBeenCalledTimes(1);
    expect(mockedApi.verifyEmail).toHaveBeenCalledWith("abc123");
    expect(router.state.location.search).toBe("");
  });

  it("re-reads the signed-in account after verifying, and offers to continue", async () => {
    mockedUseAuth.mockReturnValue(authValue(makeUser({ isVerified: false }), { refreshUser }));
    mockedApi.verifyEmail.mockResolvedValue(undefined);
    renderAt("/verify-email?token=abc123");

    await screen.findByText("Email verified");
    expect(refreshUser).toHaveBeenCalled();

    await userEvent.click(screen.getByRole("link", { name: "Continue" }));
    expect(await screen.findByText("Home")).toBeInTheDocument();
  });

  it("still shows success when signed out (refreshing the account fails harmlessly)", async () => {
    refreshUser.mockRejectedValue(new ApiError("Access token is missing", 401));
    mockedApi.verifyEmail.mockResolvedValue(undefined);

    renderAt("/verify-email?token=abc123");

    expect(await screen.findByText("Email verified")).toBeInTheDocument();
  });

  it("shows the backend's reason for an invalid or expired link", async () => {
    mockedApi.verifyEmail.mockRejectedValue(
      new ApiError("This verification link is invalid or has expired. Please request a new one.", 400),
    );

    renderAt("/verify-email?token=old");

    expect(await screen.findByText("We couldn't verify your email")).toBeInTheDocument();
    expect(screen.getByText(/invalid or has expired/)).toBeInTheDocument();
  });

  it("asks a signed-out visitor to log in to get a new link", async () => {
    mockedApi.verifyEmail.mockRejectedValue(new ApiError("expired", 400));

    renderAt("/verify-email?token=old");

    expect(await screen.findByRole("link", { name: "Log in to request a new link" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("lets a signed-in user request a new link right there", async () => {
    mockedUseAuth.mockReturnValue(authValue(makeUser({ isVerified: false }), { refreshUser }));
    mockedApi.verifyEmail.mockRejectedValue(new ApiError("expired", 400));
    mockedApi.resendVerificationEmail.mockResolvedValue("Verification email sent to aisha@example.com");
    renderAt("/verify-email?token=old");

    await userEvent.click(await screen.findByRole("button", { name: "Send me a new link" }));

    expect(await screen.findByText("Verification email sent to aisha@example.com")).toBeInTheDocument();
  });

  it("does not call the backend when the link has no token", async () => {
    renderAt("/verify-email");

    expect(await screen.findByText("This link is missing its verification token.")).toBeInTheDocument();
    expect(mockedApi.verifyEmail).not.toHaveBeenCalled();
  });
});
