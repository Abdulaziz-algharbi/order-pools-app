import { vi } from "vitest";
import type { useAuth } from "@/context/AuthContext";
import type { AppUser } from "@/types/domain";

export function makeUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    _id: "user-1",
    firstName: "Aisha",
    lastName: "Said",
    email: "aisha@example.com",
    phoneNumber: "+96890000000",
    companyName: "Said Trading",
    roles: ["RETAILER"],
    addresses: [],
    isVerified: true,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

/** A full `useAuth()` value for tests that mock `@/context/AuthContext`. */
export function authValue(
  user: AppUser | null,
  overrides: Partial<ReturnType<typeof useAuth>> = {},
): ReturnType<typeof useAuth> {
  return {
    user,
    isLoading: false,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    updateProfile: vi.fn(),
    removeAccount: vi.fn(),
    ...overrides,
  };
}
