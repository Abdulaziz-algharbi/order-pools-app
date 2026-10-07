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

  const optionTexts = (dialog: HTMLElement) =>
    within(within(dialog).getByLabelText(/Quantity/)).getAllByRole("option").map((o) => o.textContent);

  it("offers whole lots and the rest, each with its exact total", async () => {
    const dialog = await openJoin({ currentQuantity: 100, minimumContribution: 25, minimumContributionPrice: 300 });

    expect(optionTexts(dialog)).toEqual([
      "25 box — 300.000 OMR",
      "50 box — 600.000 OMR",
      "75 box — 900.000 OMR",
      "All 100 still free — 1,200.000 OMR",
    ]);
    expect(within(dialog).getByText(/In lots of 25 · 300\.000 OMR per lot\./)).toBeInTheDocument();
    expect(within(dialog).getByText("300.000 OMR")).toBeInTheDocument();
  });

  it("never offers a size that would strand the leftover, and prices the leftover pro rata", async () => {
    const dialog = await openJoin({ currentQuantity: 100, minimumContribution: 30, minimumContributionPrice: 300 });

    expect(optionTexts(dialog)).toEqual([
      "30 box — 300.000 OMR",
      "60 box — 600.000 OMR",
      "All 100 still free (3 lots + 10 left over) — 1,000.000 OMR",
    ]);
    expect(within(dialog).getByText(/The last joiner also takes the 10 left over\./)).toBeInTheDocument();
  });

  it("leaves only the last lot and the leftover together", async () => {
    const dialog = await openJoin({ currentQuantity: 40, minimumContribution: 30, minimumContributionPrice: 300 });

    expect(optionTexts(dialog)).toEqual(["All 40 still free (1 lot + 10 left over) — 400.000 OMR"]);
  });

  it("joins with the chosen size and goes to the payment page", async () => {
    mockedApi.joinPool.mockResolvedValue({ checkoutUrl: "https://pay.example/checkout" } as never);
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    const dialog = await openJoin({ currentQuantity: 100, minimumContribution: 25, minimumContributionPrice: 300 });

    await screen.findByRole("option", { name: /All 100/ });
    await user().selectOptions(within(dialog).getByLabelText(/Quantity/), "50");
    expect(within(dialog).getByText("600.000 OMR")).toBeInTheDocument();
    await user().click(within(dialog).getByRole("button", { name: "Continue to payment" }));

    expect(mockedApi.joinPool).toHaveBeenCalledWith({ pool_ref: "pool-1", address_ref: "addr-1", quantity: 50 });
    expect(assign).toHaveBeenCalledWith("https://pay.example/checkout");
    vi.unstubAllGlobals();
  });

  // Lots of 1 in a big pool would be a list of hundreds.
  it("asks for a typed quantity in a pool with too many sizes to list, checking it", async () => {
    const dialog = await openJoin({ currentQuantity: 500, minimumContribution: 2, minimumContributionPrice: 10 });
    const field = within(dialog).getByLabelText(/Quantity/);

    expect(field.tagName).toBe("INPUT");
    await user().clear(field);
    await user().type(field, "499");
    await user().click(within(dialog).getByRole("button", { name: "Continue to payment" }));

    expect(within(dialog).getByText("Choose a multiple of 2 up to 498, or all 500 still free.")).toBeInTheDocument();
    expect(mockedApi.joinPool).not.toHaveBeenCalled();
  });

  it("says when nothing is free to join", async () => {
    const dialog = await openJoin({ currentQuantity: 0, minimumContribution: 25, minimumContributionPrice: 300 });

    expect(within(dialog).getAllByText("Nothing is free to join in this pool right now.")).not.toHaveLength(0);
    expect(within(dialog).getByRole("button", { name: "Continue to payment" })).toBeDisabled();
  });
});
