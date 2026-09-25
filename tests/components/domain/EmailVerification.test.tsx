import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmailVerificationBanner } from "@/components/domain/EmailVerification";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/services/api";
import { ApiError } from "@/lib/http";
import { authValue, makeUser } from "../../fixtures/auth";

vi.mock("@/context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/services/api", () => ({ resendVerificationEmail: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);
const mockedApi = vi.mocked(api);
const refreshUser = vi.fn();

function renderFor(isVerified: boolean) {
  mockedUseAuth.mockReturnValue(authValue(makeUser({ isVerified }), { refreshUser }));
  render(<EmailVerificationBanner />);
}

beforeEach(() => {
  vi.resetAllMocks();
  refreshUser.mockResolvedValue(makeUser());
});

describe("EmailVerificationBanner", () => {
  it("is not shown once the email is verified", () => {
    renderFor(true);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("is not shown when signed out", () => {
    mockedUseAuth.mockReturnValue(authValue(null));
    render(<EmailVerificationBanner />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("tells an unverified user where the link went and what is blocked", () => {
    renderFor(false);

    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("Please verify your email address");
    expect(banner).toHaveTextContent("aisha@example.com");
    expect(banner).toHaveTextContent("can't join pools, request supplier access or create offers");
  });

  it("resends the email and shows the backend's confirmation", async () => {
    mockedApi.resendVerificationEmail.mockResolvedValue("Verification email sent to aisha@example.com");
    renderFor(false);

    await userEvent.click(screen.getByRole("button", { name: "Resend verification email" }));

    expect(mockedApi.resendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Verification email sent to aisha@example.com")).toBeInTheDocument();
  });

  it("shows the backend's cooldown message when resending too soon", async () => {
    mockedApi.resendVerificationEmail.mockRejectedValue(
      new ApiError("A verification email was sent recently. Please wait a minute before requesting another.", 429),
    );
    renderFor(false);

    await userEvent.click(screen.getByRole("button", { name: "Resend verification email" }));

    expect(await screen.findByText(/Please wait a minute/)).toBeInTheDocument();
    expect(refreshUser).not.toHaveBeenCalled();
  });

  it("re-reads the account when the backend says it is already verified (verified in another tab)", async () => {
    mockedApi.resendVerificationEmail.mockRejectedValue(
      new ApiError("Your email address is already verified", 409),
    );
    renderFor(false);

    await userEvent.click(screen.getByRole("button", { name: "Resend verification email" }));

    await waitFor(() => expect(refreshUser).toHaveBeenCalledTimes(1));
  });
});
