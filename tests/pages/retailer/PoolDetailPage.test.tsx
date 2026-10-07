import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  productImages: [],
  unit: "BOX",
  supplierName: "Gulf Foods",
  targetQuantity: 100,
  currentQuantity: 40,
  minimumContribution: 5,
  minimumContributionPrice: 60,
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

describe("PoolDetailPage — product images", () => {
  it("shows all of the pool's images to a retailer", async () => {
    mockedUseAuth.mockReturnValue(authValue(makeUser({ isVerified: true })));
    mockedApi.getPool.mockResolvedValue({
      ...openPool,
      productImages: [
        { publicId: "orderpools/dev/offers/s1/cover", version: 1 },
        { publicId: "orderpools/dev/offers/s1/side", version: 1 },
      ],
    });

    renderPage();

    expect(await screen.findByAltText("Basmati Rice 25kg, image 1 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show image 2 of 2" })).toBeInTheDocument();
  });
});


// Reference scenario (order-pools-backend/docs/pricing-model-plan.md):
// 100 free, in lots of 25 at 300 OMR. Leftover scenario: lots of 30.
describe("PoolDetailPage — choosing how much to join", () => {
  const user = () => userEvent.setup();
  const address = { _id: "addr-1", location: "x", region: "Muscat", city: "Bawshar" };

  beforeEach(() => {
    mockedUseAuth.mockReturnValue(authValue(makeUser({ isVerified: true })));
    mockedApi.listMyAddresses.mockResolvedValue([address] as never);
  });

  async function openJoin(pool: Partial<Pool>) {
    mockedApi.getPool.mockResolvedValue({ ...openPool, ...pool });
    renderPage();
    await user().click(await screen.findByRole("button", { name: "Join this pool" }));
    return screen.getByRole("dialog", { name: "Join this pool" });
  }

  const lotsField = (dialog: HTMLElement) => within(dialog).getByLabelText(/Number of lots/);

  it("starts at one lot and steps up to every lot, with the total following", async () => {
    const dialog = await openJoin({ currentQuantity: 100, minimumContribution: 25, minimumContributionPrice: 300 });

    expect(lotsField(dialog)).toHaveValue(1);
    expect(within(dialog).getByText("25 box · 300.000 OMR")).toBeInTheDocument();

    for (let i = 0; i < 3; i++) await user().click(within(dialog).getByRole("button", { name: "More lots" }));

    expect(lotsField(dialog)).toHaveValue(4);
    expect(within(dialog).getByText("100 box · 1,200.000 OMR")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "More lots" })).toBeDisabled();
    // Nothing is left over, so the last lot already takes everything.
    expect(within(dialog).queryByText(/Take everything still free/)).not.toBeInTheDocument();
  });

  it("stops a lot short of stranding the leftover, which only 'take everything' takes", async () => {
    const dialog = await openJoin({ currentQuantity: 100, minimumContribution: 30, minimumContributionPrice: 300 });

    await user().click(within(dialog).getByRole("button", { name: "More lots" }));
    expect(lotsField(dialog)).toHaveValue(2);
    expect(within(dialog).getByRole("button", { name: "More lots" })).toBeDisabled();

    await user().click(within(dialog).getByLabelText(/Take everything still free: 100 box \(3 lots \+ 10 left over\)/));
    expect(within(dialog).getByText("100 box · 1,000.000 OMR")).toBeInTheDocument();
  });

  it("offers only the last lot and the leftover together", async () => {
    const dialog = await openJoin({ currentQuantity: 40, minimumContribution: 30, minimumContributionPrice: 300 });

    expect(within(dialog).queryByLabelText(/Number of lots/)).not.toBeInTheDocument();
    expect(within(dialog).getByText("40 box (1 lot + 10 left over)")).toBeInTheDocument();
    expect(within(dialog).getByText("40 box · 400.000 OMR")).toBeInTheDocument();
  });

  it("joins with the chosen size and goes to the payment page", async () => {
    mockedApi.joinPool.mockResolvedValue({ checkoutUrl: "https://pay.example/checkout" } as never);
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    const dialog = await openJoin({ currentQuantity: 100, minimumContribution: 25, minimumContributionPrice: 300 });

    await within(dialog).findByRole("combobox");
    await user().click(within(dialog).getByRole("button", { name: "More lots" }));
    expect(within(dialog).getByText("50 box · 600.000 OMR")).toBeInTheDocument();
    await user().click(within(dialog).getByRole("button", { name: "Continue to payment" }));

    expect(mockedApi.joinPool).toHaveBeenCalledWith({ pool_ref: "pool-1", address_ref: "addr-1", quantity: 50 });
    expect(assign).toHaveBeenCalledWith("https://pay.example/checkout");
    vi.unstubAllGlobals();
  });

  // Lots of 2 in a pool of 500: no list to scroll, just a number of lots.
  it("refuses a typed number of lots out of range, and can't continue with it", async () => {
    const dialog = await openJoin({ currentQuantity: 500, minimumContribution: 2, minimumContributionPrice: 10 });

    await user().clear(lotsField(dialog));
    await user().type(lotsField(dialog), "251");

    expect(within(dialog).getByText("Choose 1 to 250 lots.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Continue to payment" })).toBeDisabled();
    expect(mockedApi.joinPool).not.toHaveBeenCalled();
  });

  it("says when nothing is free to join", async () => {
    const dialog = await openJoin({ currentQuantity: 0, minimumContribution: 25, minimumContributionPrice: 300 });

    expect(within(dialog).getByText("Nothing is free to join in this pool right now.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Continue to payment" })).toBeDisabled();
  });
});
