import { beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "@/lib/http";
import { approveOffer, createPool, updatePool } from "@/services/api";

vi.mock("@/lib/http", () => ({ request: vi.fn() }));

const mockedRequest = vi.mocked(request);

beforeEach(() => {
  mockedRequest.mockReset();
  mockedRequest.mockResolvedValue({ message: "ok", data: { offer: {}, pool: {} } });
});

describe("services/api — approveOffer", () => {
  // One request approves the offer and creates its pool together, so a
  // failed pool can no longer leave an approved offer behind.
  it("sends the pool terms to the single approve endpoint", async () => {
    await approveOffer("offer-1", {
      minimumContribution: 25,
      minimumContributionPrice: 300,
      endDate: "2026-12-01T00:00:00.000Z",
      adminComment: "Welcome",
    });

    expect(mockedRequest).toHaveBeenCalledTimes(1);
    expect(mockedRequest).toHaveBeenCalledWith("/offers/offer-1/approve", {
      method: "POST",
      body: {
        minimumContribution: 25,
        minimumContributionPrice: 300,
        endDate: "2026-12-01T00:00:00.000Z",
        adminComment: "Welcome",
      },
    });
  });
});

describe("services/api — createPool / updatePool", () => {
  // Running an offer again after its pool was CANCELLED: the pool's
  // quantity is the offer's, so only the lot terms are sent.
  it("sends the lot terms, with no quantity", async () => {
    mockedRequest.mockResolvedValue({ _id: "pool-2" });

    await createPool({
      productoffer_ref: "offer-1",
      minimumContribution: 25,
      minimumContributionPrice: 300,
      endDate: "2026-12-01T00:00:00.000Z",
    });

    expect(mockedRequest).toHaveBeenCalledWith("/pools", {
      method: "POST",
      body: {
        productoffer_ref: "offer-1",
        minimumContribution: 25,
        minimumContributionPrice: 300,
        endDate: "2026-12-01T00:00:00.000Z",
      },
    });
  });

  it("patches only what the backend still lets an admin change", async () => {
    mockedRequest.mockResolvedValue({ message: "ok", data: {} });

    await updatePool("pool-1", { endDate: "2026-12-31T00:00:00.000Z" });

    expect(mockedRequest).toHaveBeenCalledWith("/pools/pool-1", {
      method: "PATCH",
      body: { endDate: "2026-12-31T00:00:00.000Z" },
    });
  });
});
