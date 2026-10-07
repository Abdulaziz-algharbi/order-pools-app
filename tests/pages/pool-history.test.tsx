import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPoolHistoryPage } from "@/pages/admin/AdminPoolHistoryPage";
import { SupplierPoolHistoryPage } from "@/pages/supplier/SupplierPoolHistoryPage";
import { listPools } from "@/services/api";
import { makePool } from "../fixtures/pools";

vi.mock("@/services/api", () => ({ listPools: vi.fn() }));
const mockedListPools = vi.mocked(listPools);

// Leftover scenario (order-pools-backend/docs/pricing-model-plan.md): 100
// units in lots of 30 at 300 OMR, all taken: 3 lots + 10 left over at
// their share of a lot = 1,000 OMR.
beforeEach(() => {
  mockedListPools.mockReset();
  mockedListPools.mockResolvedValue([
    makePool({
      _id: "p1",
      productName: "Dates 5kg",
      status: "COMPLETED",
      targetQuantity: 100,
      currentQuantity: 0,
      paidQuantity: 100,
      minimumContribution: 30,
      minimumContributionPrice: 300,
    }),
  ]);
});

describe.each([
  ["admin Pool History", AdminPoolHistoryPage],
  ["supplier Pool History", SupplierPoolHistoryPage],
])("%s", (_name, Page) => {
  it("values the joined quantity at the lot price, the leftover included, in OMR", async () => {
    render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>,
    );

    expect((await screen.findAllByText("1,000.000 OMR")).length).toBeGreaterThan(0);
  });
});
