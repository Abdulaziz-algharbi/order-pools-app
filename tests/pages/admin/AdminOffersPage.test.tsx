import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminOffersPage } from "@/pages/admin/AdminOffersPage";
import { AdminOffersHistoryPage } from "@/pages/admin/AdminOffersHistoryPage";
import { getUserById, listOffers } from "@/services/api";
import type { ProductOffer } from "@/types/domain";

vi.mock("@/services/api", () => ({
  listOffers: vi.fn(),
  getUserById: vi.fn(),
  approveOffer: vi.fn(),
  reviewOffer: vi.fn(),
}));

const mockedListOffers = vi.mocked(listOffers);
const mockedGetUser = vi.mocked(getUserById);

const image = (name: string) => ({ publicId: `orderpools/dev/offers/s1/${name}`, version: 1 });

function makeOffer(overrides: Partial<ProductOffer> = {}): ProductOffer {
  return {
    _id: "offer-1",
    user_ref: "s1",
    name: "Dates 5kg",
    description: "Khalas dates",
    brand: null,
    unit: "BOX",
    images: [image("cover"), image("side")],
    wholeQuantity: 40,
    price: 3,
    status: "PENDING",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedGetUser.mockResolvedValue({ _id: "s1", companyName: "Date Farms" } as never);
});

function renderPage(Page: () => React.JSX.Element) {
  render(
    <MemoryRouter>
      <Page />
    </MemoryRouter>,
  );
}

describe("AdminOffersPage — offer images", () => {
  it("previews each offer's images in the review list, cover first", async () => {
    mockedListOffers.mockResolvedValue([makeOffer()]);
    renderPage(AdminOffersPage);

    const previews = await screen.findByRole("list", { name: "Dates 5kg images" });
    const thumbs = within(previews).getAllByRole("img");
    expect(thumbs).toHaveLength(2);
    expect(thumbs[0]).toHaveAttribute("alt", "Dates 5kg, image 1 of 2");
    expect(thumbs[0]).toHaveAttribute("src", expect.stringContaining("c_fill,w_160,h_160"));
    expect(within(previews).getByText("Cover")).toBeInTheDocument();
  });

  it("says when an offer has no images", async () => {
    mockedListOffers.mockResolvedValue([makeOffer({ images: [] })]);
    renderPage(AdminOffersPage);

    expect(await screen.findByText("No images")).toBeInTheDocument();
  });

  it.each([
    ["Accept", "Accept this offer?"],
    ["Request negotiation", "Request negotiation"],
    ["Reject", "Reject this offer?"],
  ])("shows the images full size when the admin chooses %s", async (button, title) => {
    mockedListOffers.mockResolvedValue([makeOffer()]);
    renderPage(AdminOffersPage);

    await userEvent.click(await screen.findByRole("button", { name: button }));

    const dialog = screen.getByRole("dialog", { name: title });
    expect(within(dialog).getByAltText("Dates 5kg, image 1 of 2")).toHaveAttribute(
      "src",
      expect.stringContaining("c_limit,w_1600,h_1600"),
    );
    expect(within(dialog).getByRole("button", { name: "Show image 2 of 2" })).toBeInTheDocument();
  });
});

describe("AdminOffersHistoryPage — offer images", () => {
  it("shows each offer's cover next to its name, or a placeholder", async () => {
    mockedListOffers.mockResolvedValue([
      makeOffer({ _id: "o1", status: "APPROVED" }),
      makeOffer({ _id: "o2", name: "Saffron 1g", status: "REJECTED", images: [] }),
    ]);
    renderPage(AdminOffersHistoryPage);

    const covers = await screen.findAllByAltText("Dates 5kg");
    expect(covers[0]).toHaveAttribute("src", expect.stringContaining("/orderpools/dev/offers/s1/cover"));
    expect(screen.getAllByRole("img", { name: "No product image" }).length).toBeGreaterThan(0);
  });
});
