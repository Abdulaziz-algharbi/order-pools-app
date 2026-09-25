import { beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "@/lib/http";
import {
  fetchCurrentUser,
  login,
  logout,
  register,
  resendVerificationEmail,
  verifyEmail,
} from "@/services/api";

vi.mock("@/lib/http", () => ({ request: vi.fn() }));

const mockedRequest = vi.mocked(request);

beforeEach(() => {
  mockedRequest.mockReset();
});

describe("services/api — auth endpoints", () => {
  it("login posts credentials without the refresh-on-401 behaviour and returns nothing", async () => {
    mockedRequest.mockResolvedValue({ message: "Login successful" });

    const result = await login("a@b.c", "secret");

    expect(mockedRequest).toHaveBeenCalledWith("/auth/login", {
      method: "POST",
      body: { email: "a@b.c", password: "secret" },
      auth: false,
    });
    // Tokens live only in httpOnly cookies — nothing is handed back to JS.
    expect(result).toBeUndefined();
  });

  it("register posts the input without refresh-on-401 and returns nothing", async () => {
    mockedRequest.mockResolvedValue({ message: "User registered" });
    const input = {
      firstName: "A",
      lastName: "B",
      email: "a@b.c",
      phoneNumber: "+96890000000",
      companyName: "Co",
      password: "secret",
      addresses: ["a1"],
    };

    const result = await register(input);

    expect(mockedRequest).toHaveBeenCalledWith("/auth/register", {
      method: "POST",
      body: input,
      auth: false,
    });
    expect(result).toBeUndefined();
  });

  it("logout posts with no body — the backend reads the session from its cookies", async () => {
    mockedRequest.mockResolvedValue({ message: "Logged out" });

    await logout();

    expect(mockedRequest).toHaveBeenCalledWith("/auth/logout", { method: "POST" });
  });

  it("fetchCurrentUser unwraps the { user } envelope", async () => {
    mockedRequest.mockResolvedValue({ user: { _id: "u1" } });

    await expect(fetchCurrentUser()).resolves.toEqual({ _id: "u1" });
    expect(mockedRequest).toHaveBeenCalledWith("/auth/me");
  });

  it("verifyEmail posts the link's token without the refresh-on-401 behaviour", async () => {
    mockedRequest.mockResolvedValue({ message: "Email address verified" });

    await verifyEmail("abc123");

    expect(mockedRequest).toHaveBeenCalledWith("/auth/verify-email", {
      method: "POST",
      body: { token: "abc123" },
      auth: false,
    });
  });

  it("resendVerificationEmail returns the backend's confirmation message", async () => {
    mockedRequest.mockResolvedValue({ message: "Verification email sent to a@b.c" });

    await expect(resendVerificationEmail()).resolves.toBe("Verification email sent to a@b.c");
    expect(mockedRequest).toHaveBeenCalledWith("/auth/resend-verification", { method: "POST" });
  });
});
