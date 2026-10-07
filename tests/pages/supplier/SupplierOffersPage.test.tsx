import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupplierOffersPage } from "@/pages/supplier/SupplierOffersPage";
import { listOffers } from "@/services/api";
import type { ProductOffer } from "@/types/domain";

vi.mock("@/services/api", () => ({ listOffers: vi.fn() }));

const mockedListOffers = vi.mocked(listOffers);

const offer: ProductOffer = {
  _id: "offer-1",
  user_ref: "s1",
  name: "Basmati Rice 25kg",
  description: "Premium long grain",
  brand: null,
  unit: "CARTON",
  images: [],
  wholeQuantity: 100,
  totalWholesalePrice: 1000,
  status: "PENDING",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.resetAllMocks();
  mockedListOffers.mockResolvedValue([offer]);
});

describe("SupplierOffersPage", () => {
  // The supplier's price is for the whole offer, in OMR.
  it("lists each offer's total price in OMR", async () => {
    render(
      <MemoryRouter>
        <SupplierOffersPage />
      </MemoryRouter>,
    );

    expect(await screen.findAllByText("1,000.000 OMR")).not.toHaveLength(0);
    expect(screen.getAllByText("Total price")).not.toHaveLength(0);
  });
});
