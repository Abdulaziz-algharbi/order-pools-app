import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PoolsBrowsePage } from "@/pages/retailer/PoolsBrowsePage";
import { SupplierPoolsPage } from "@/pages/supplier/SupplierPoolsPage";
import { listPools } from "@/services/api";
import { makePool } from "../fixtures/pools";

vi.mock("@/services/api", () => ({ listPools: vi.fn() }));
const mockedListPools = vi.mocked(listPools);

const cover = { publicId: "orderpools/dev/offers/s1/cover", version: 1 };

beforeEach(() => {
  mockedListPools.mockReset();
  mockedListPools.mockResolvedValue([
    makePool({ _id: "p1", productName: "Dates 5kg", productImages: [cover] }),
    makePool({ _id: "p2", productName: "Saffron 1g", productImages: [] }),
  ]);
});

// Both lists render PoolCard, so retailers and suppliers see the same
// cover (or placeholder) for each pool.
describe.each([
  ["retailer Browse Pools", PoolsBrowsePage],
  ["supplier Active Pools", SupplierPoolsPage],
])("%s", (_label, Page) => {
  it("shows each pool's cover image, or a placeholder", async () => {
    render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>,
    );

    expect(await screen.findByAltText("Dates 5kg")).toHaveAttribute(
      "src",
      expect.stringContaining("/orderpools/dev/offers/s1/cover"),
    );
    expect(screen.getByRole("img", { name: "No product image" })).toBeInTheDocument();
  });
});
