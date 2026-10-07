import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupplierPayoutsPage } from "@/pages/supplier/SupplierPayoutsPage";
import { listPayouts, listPools } from "@/services/api";
import { makePool } from "../../fixtures/pools";

vi.mock("@/services/api", () => ({ listPayouts: vi.fn(), listPools: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listPools).mockResolvedValue([makePool({ _id: "pool-1", productName: "Dates 5kg" })]);
  vi.mocked(listPayouts).mockResolvedValue([
    {
      _id: "payout-1",
      pool_ref: "pool-1",
      amount: 1000,
      status: "PENDING",
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    },
  ]);
});

describe("SupplierPayoutsPage", () => {
  // The payout is the offer's whole price, in OMR (never a USD amount).
  it("shows the amount owed in OMR", async () => {
    render(
      <MemoryRouter>
        <SupplierPayoutsPage />
      </MemoryRouter>,
    );

    expect((await screen.findAllByText("1,000.000 OMR")).length).toBeGreaterThan(0);
  });
});
