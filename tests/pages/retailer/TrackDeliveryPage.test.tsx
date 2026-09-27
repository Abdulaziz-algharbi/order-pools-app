import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrackDeliveryPage } from "@/pages/retailer/TrackDeliveryPage";
import * as api from "@/services/api";
import { makeParticipant, makePool } from "../../fixtures/pools";

vi.mock("@/services/api", () => ({
  listMyParticipants: vi.fn(),
  listPools: vi.fn(),
  listDeliveries: vi.fn(),
}));

const mockedApi = vi.mocked(api);

function renderPage() {
  render(
    <MemoryRouter>
      <TrackDeliveryPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedApi.listDeliveries.mockResolvedValue([]);
  mockedApi.listPools.mockResolvedValue([
    makePool({ _id: "pool-paid", productName: "Basmati Rice 25kg", status: "DISTRIBUTING" }),
    makePool({ _id: "pool-left", productName: "Olive Oil 5L", status: "DISTRIBUTING" }),
    makePool({ _id: "pool-failed", productName: "Sugar 50kg", status: "TARGET_REACHED" }),
  ]);
});

describe("TrackDeliveryPage", () => {
  it("shows only pools the retailer paid into, not withdrawn or failed joins", async () => {
    mockedApi.listMyParticipants.mockResolvedValue([
      makeParticipant({ _id: "p-1", pool_ref: "pool-paid", status: "WAITING" }),
      makeParticipant({ _id: "p-2", pool_ref: "pool-left", status: "WITHDRAWN" }),
      makeParticipant({ _id: "p-3", pool_ref: "pool-failed", status: "PAYMENT_FAILED" }),
    ]);

    renderPage();

    expect(await screen.findByText("Basmati Rice 25kg")).toBeInTheDocument();
    expect(screen.queryByText("Olive Oil 5L")).not.toBeInTheDocument();
    expect(screen.queryByText("Sugar 50kg")).not.toBeInTheDocument();
  });

  it("shows nothing to track when the retailer withdrew from every pool", async () => {
    mockedApi.listMyParticipants.mockResolvedValue([
      makeParticipant({ _id: "p-2", pool_ref: "pool-left", status: "WITHDRAWN" }),
    ]);

    renderPage();

    expect(await screen.findByText("No deliveries to track yet")).toBeInTheDocument();
  });
});
