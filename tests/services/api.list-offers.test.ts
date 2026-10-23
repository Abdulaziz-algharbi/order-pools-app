import { beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "@/lib/http";
import { listOffers, listOffersPage } from "@/services/api";
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

describe("listOffersPage", () => {
  it("asks the backend for one page of the statuses", async () => {
    mockedRequest.mockResolvedValue({ message: "ok", data: [], total: 0, page: 2, limit: 20 });

    await listOffersPage({ status: ["APPROVED", "REJECTED"] }, 2, 20);

    expect(mockedRequest).toHaveBeenCalledWith("/offers", {
      query: { status: "APPROVED,REJECTED", page: 2, limit: 20 },
    });
  });

  it("works out the page count from the total", async () => {
    const offers = [{ _id: "o21" }] as ProductOffer[];
    mockedRequest.mockResolvedValue({ message: "ok", data: offers, total: 41, page: 3, limit: 20 });

    expect(await listOffersPage({ status: "APPROVED" }, 3, 20)).toEqual({
      items: offers,
      total: 41,
      page: 3,
      pageCount: 3,
    });
  });

  // The backend caps limit at 100: count pages by what it actually used.
  it("counts pages by the limit the backend applied", async () => {
    mockedRequest.mockResolvedValue({ message: "ok", data: [], total: 250, page: 1, limit: 100 });

    expect((await listOffersPage({}, 1, 500)).pageCount).toBe(3);
  });

  it("still has one (empty) page when there are no offers", async () => {
    mockedRequest.mockResolvedValue({ message: "ok", data: [], total: 0, page: 1, limit: 20 });

    expect((await listOffersPage({}, 1, 20)).pageCount).toBe(1);
  });
});
