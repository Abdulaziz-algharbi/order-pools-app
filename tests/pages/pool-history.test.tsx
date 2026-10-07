import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPoolHistoryPage } from "@/pages/admin/AdminPoolHistoryPage";
import { SupplierPoolHistoryPage } from "@/pages/supplier/SupplierPoolHistoryPage";
import { listPayouts, listPools } from "@/services/api";
import type { SupplierPayout } from "@/types/domain";
import { makePool } from "../fixtures/pools";

vi.mock("@/services/api", () => ({ listPools: vi.fn(), listPayouts: vi.fn() }));
const mockedListPools = vi.mocked(listPools);
const mockedListPayouts = vi.mocked(listPayouts);

// Leftover scenario (order-pools-backend/docs/pricing-model-plan.md): 100
// units in lots of 30 at 330 OMR, all taken: 3 lots + 10 left over at their
// share of a lot = 1,100 OMR from retailers. The supplier's price for the
// whole offer is 1,000 OMR.
const completed = makePool({
  _id: "p1",
  productName: "Dates 5kg",
  status: "COMPLETED",
  targetQuantity: 100,
  currentQuantity: 0,
  paidQuantity: 100,
  minimumContribution: 30,
  minimumContributionPrice: 330,
});
const cancelled = makePool({ _id: "p2", productName: "Saffron 1g", status: "CANCELLED" });

const payout: SupplierPayout = {
  _id: "payout-1",
  pool_ref: "p1",
  amount: 1000,
  status: "PENDING",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

function renderPage(Page: () => React.JSX.Element) {
  render(
    <MemoryRouter>
      <Page />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedListPools.mockResolvedValue([completed, cancelled]);
  mockedListPayouts.mockResolvedValue([payout]);
});

describe("admin Pool History", () => {
  // The admin sets the margin, so sees what retailers paid.
  it("values the joined quantity at the lot price, the leftover included, in OMR", async () => {
    renderPage(AdminPoolHistoryPage);

    expect((await screen.findAllByText("1,100.000 OMR")).length).toBeGreaterThan(0);
  });
});

describe("supplier Pool History", () => {
  it("shows the supplier's payout for a completed pool, with its status", async () => {
    renderPage(SupplierPoolHistoryPage);

    expect((await screen.findAllByText("1,000.000 OMR")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pending").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Your payout").length).toBeGreaterThan(0);
  });

  it("says a cancelled pool has no payout", async () => {
    renderPage(SupplierPoolHistoryPage);

    expect((await screen.findAllByText("No payout (cancelled)")).length).toBeGreaterThan(0);
  });

  // What retailers paid at the admin's lot price is the platform's business.
  it("never shows the supplier the retail value", async () => {
    renderPage(SupplierPoolHistoryPage);

    await screen.findAllByText("1,000.000 OMR");
    expect(screen.queryByText("1,100.000 OMR")).not.toBeInTheDocument();
    expect(screen.queryByText("Total value")).not.toBeInTheDocument();
  });

  it("still lists the pools when payouts can't be loaded", async () => {
    mockedListPayouts.mockRejectedValue(new Error("down"));
    renderPage(SupplierPoolHistoryPage);

    expect((await screen.findAllByText("Dates 5kg")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});
