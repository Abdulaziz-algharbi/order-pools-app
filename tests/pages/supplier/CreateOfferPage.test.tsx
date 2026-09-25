import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateOfferPage } from "@/pages/supplier/CreateOfferPage";
import { useAuth } from "@/context/AuthContext";
import { authValue, makeUser } from "../../fixtures/auth";

vi.mock("@/context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/services/api", () => ({ createOffer: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);

function renderPage() {
  render(
    <MemoryRouter>
      <CreateOfferPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("CreateOfferPage — email verification gate", () => {
  it("lets a verified supplier submit", () => {
    mockedUseAuth.mockReturnValue(authValue(makeUser({ roles: ["SUPPLIER"], isVerified: true })));

    renderPage();

    expect(screen.getByRole("button", { name: "Submit offer" })).toBeEnabled();
  });

  it("disables submitting for an unverified supplier and explains why", () => {
    mockedUseAuth.mockReturnValue(authValue(makeUser({ roles: ["SUPPLIER"], isVerified: false })));

    renderPage();

    expect(screen.getByRole("button", { name: "Submit offer" })).toBeDisabled();
    expect(screen.getByText(/Verify your email address to submit an offer/)).toBeInTheDocument();
  });
});
