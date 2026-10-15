import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPoolDetailPage } from "@/pages/admin/AdminPoolDetailPage";
import * as api from "@/services/api";
import { ApiError } from "@/lib/http";
import type { Pool } from "@/types/domain";
import { makePool } from "../../fixtures/pools";

vi.mock("@/services/api", () => ({
  cancelPool: vi.fn(),
  createDelivery: vi.fn(),
  expirePool: vi.fn(),
  getPool: vi.fn(),
  getUserById: vi.fn(),
  listDeliveries: vi.fn(),
  listPoolParticipants: vi.fn(),
  updateDeliveryStatus: vi.fn(),
}));

const mockedApi = vi.mocked(api);

const FUTURE = "2099-01-01T00:00:00.000Z";
const PAST = "2020-01-01T00:00:00.000Z";

function renderPool(pool: Pool) {
  mockedApi.getPool.mockResolvedValue(pool);
  render(
    <MemoryRouter initialEntries={[`/admin/pools/${pool._id}`]}>
      <Routes>
        <Route path="/admin/pools/:poolId" element={<AdminPoolDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedApi.listPoolParticipants.mockResolvedValue([]);
  mockedApi.listDeliveries.mockResolvedValue([]);
});

describe("AdminPoolDetailPage — cancelling a pool", () => {
  it.each(["OPEN", "TARGET_REACHED"] as const)("offers to cancel a %s pool", async (status) => {
    renderPool(makePool({ status, endDate: FUTURE }));

    expect(await screen.findByRole("button", { name: "Cancel pool" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Expire pool" })).not.toBeInTheDocument();
  });

  it.each(["DISTRIBUTING", "COMPLETED", "CANCELLED"] as const)("doesn't offer it for a %s pool", async (status) => {
    renderPool(makePool({ status, endDate: FUTURE }));

    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("button", { name: "Cancel pool" })).not.toBeInTheDocument();
  });

  // Past its end date the pool expires instead, which says why.
  it("offers Expire rather than Cancel for an OPEN pool past its end date", async () => {
    renderPool(makePool({ status: "OPEN", endDate: PAST }));

    expect(await screen.findByRole("button", { name: "Expire pool" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel pool" })).not.toBeInTheDocument();
  });

  it("says how many retailers paid and will be refunded, then cancels it", async () => {
    const pool = makePool({ _id: "pool-1", status: "OPEN", endDate: FUTURE, participantCount: 3 });
    mockedApi.cancelPool.mockResolvedValue({
      pool: { ...pool, status: "CANCELLED" },
      refundsRequested: 3,
      refundsFailed: 1,
    });
    renderPool(pool);

    await userEvent.click(await screen.findByRole("button", { name: "Cancel pool" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Cancel this pool?");
    expect(dialog).toHaveTextContent("3 retailer(s) have paid; each gets a full refund.");

    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel pool" }));

    expect(mockedApi.cancelPool).toHaveBeenCalledWith("pool-1");
    expect(await within(dialog).findByText(/3 refund\(s\) requested, 1 failed and need a retry from Payments/)).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Pool cancelled");
  });

  it("says there's nothing to refund when nobody has paid", async () => {
    renderPool(makePool({ status: "OPEN", endDate: FUTURE, participantCount: 0 }));

    await userEvent.click(await screen.findByRole("button", { name: "Cancel pool" }));

    expect(screen.getByRole("dialog")).toHaveTextContent("No retailer has paid yet, so there's nothing to refund.");
  });

  it("shows why the backend refused it, and keeps the dialog open", async () => {
    mockedApi.cancelPool.mockRejectedValue(
      new ApiError("Only an OPEN or TARGET_REACHED pool can be cancelled (this one is DISTRIBUTING)", 409),
    );
    renderPool(makePool({ status: "TARGET_REACHED", endDate: FUTURE }));

    await userEvent.click(await screen.findByRole("button", { name: "Cancel pool" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel pool" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Only an OPEN or TARGET_REACHED pool can be cancelled (this one is DISTRIBUTING)",
    );
    expect(dialog).toHaveTextContent("Cancel this pool?");
    // Reloaded, in case the pool moved on.
    expect(mockedApi.getPool).toHaveBeenCalledTimes(2);
  });

  it("closes without cancelling on Keep it open", async () => {
    renderPool(makePool({ status: "OPEN", endDate: FUTURE }));

    await userEvent.click(await screen.findByRole("button", { name: "Cancel pool" }));
    await userEvent.click(screen.getByRole("button", { name: "Keep it open" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mockedApi.cancelPool).not.toHaveBeenCalled();
  });
});
