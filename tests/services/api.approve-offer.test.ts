import { beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "@/lib/http";
import { approveOffer } from "@/services/api";

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
      minimumContribution: 100,
      pricePerUnit: 0.001,
      endDate: "2026-12-01T00:00:00.000Z",
      adminComment: "Welcome",
    });

    expect(mockedRequest).toHaveBeenCalledTimes(1);
    expect(mockedRequest).toHaveBeenCalledWith("/offers/offer-1/approve", {
      method: "POST",
      body: {
        minimumContribution: 100,
        pricePerUnit: 0.001,
        endDate: "2026-12-01T00:00:00.000Z",
        adminComment: "Welcome",
      },
    });
  });
});
