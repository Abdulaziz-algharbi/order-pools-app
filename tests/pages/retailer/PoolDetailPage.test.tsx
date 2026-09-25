import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PoolDetailPage } from "@/pages/retailer/PoolDetailPage";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/services/api";
import type { Pool } from "@/types/domain";
import { authValue, makeUser } from "../../fixtures/auth";

vi.mock("@/context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/services/api", () => ({
  getPool: vi.fn(),
  joinPool: vi.fn(),
  listMyAddresses: vi.fn(),
  createAddress: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedApi = vi.mocked(api);

const openPool: Pool = {
  _id: "pool-1",
  productoffer_ref: "offer-1",
  productName: "Basmati Rice 25kg",
  productDescription: "Premium long grain",
  unit: "BOX",
  supplierName: "Gulf Foods",
  targetQuantity: 100,
  currentQuantity: 40,
  minimumContribution: 5,
  pricePerUnit: 12,
  startDate: "2026-09-01T00:00:00.000Z",
  endDate: "2026-10-01T00:00:00.000Z",
  status: "OPEN",
  supplierPaymentStatus: "NOT_PAID",
  participantCount: 3,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/retailer/pools/pool-1"]}>
      <Routes>
        <Route path="/retailer/pools/:poolId" element={<PoolDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedApi.getPool.mockResolvedValue(openPool);
});

describe("PoolDetailPage — email verification gate", () => {
  it("lets a verified retailer join an open pool", async () => {
    mockedUseAuth.mockReturnValue(authValue(makeUser({ isVerified: true })));

    renderPage();

    expect(await screen.findByRole("button", { name: "Join this pool" })).toBeEnabled();
    expect(screen.queryByText(/Verify your email address/)).not.toBeInTheDocument();
  });

  it("disables joining for an unverified retailer and explains why", async () => {
    mockedUseAuth.mockReturnValue(authValue(makeUser({ isVerified: false })));

    renderPage();

    expect(await screen.findByRole("button", { name: "Join this pool" })).toBeDisabled();
    expect(screen.getByText(/Verify your email address to join a pool/)).toBeInTheDocument();
  });
});
