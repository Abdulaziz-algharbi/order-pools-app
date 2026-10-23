import { beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "@/lib/http";
import { listOffers } from "@/services/api";
import type { ProductOffer } from "@/types/domain";

vi.mock("@/lib/http", () => ({ request: vi.fn() }));

const mockedRequest = vi.mocked(request);

beforeEach(() => {
  mockedRequest.mockReset();
  mockedRequest.mockResolvedValue({ message: "ok", data: [] });
});

describe("listOffers", () => {
  // The backend filters, so the review queue doesn't download every offer.
  it("asks the backend for the statuses, comma-separated", async () => {
    await listOffers({ status: ["PENDING", "NEGOTIATION"] });

    expect(mockedRequest).toHaveBeenCalledWith("/offers", {
      query: { status: "PENDING,NEGOTIATION" },
    });
  });

  it("accepts a single status", async () => {
    await listOffers({ status: "APPROVED" });

    expect(mockedRequest).toHaveBeenCalledWith("/offers", { query: { status: "APPROVED" } });
  });

  it("sends no filter when none is given", async () => {
    await listOffers();
    await listOffers({ status: [] });

    expect(mockedRequest).toHaveBeenNthCalledWith(1, "/offers", undefined);
    expect(mockedRequest).toHaveBeenNthCalledWith(2, "/offers", undefined);
  });

  // Newest first is the backend's order; re-sorting here would only hide a
  // backend regression.
  it("returns the offers in the order the backend sent them", async () => {
    const offers = [
      { _id: "older", createdAt: "2026-01-01T00:00:00Z" },
      { _id: "newer", createdAt: "2026-02-01T00:00:00Z" },
    ] as ProductOffer[];
    mockedRequest.mockResolvedValue({ message: "ok", data: offers });

    expect((await listOffers()).map((o) => o._id)).toEqual(["older", "newer"]);
  });
});
