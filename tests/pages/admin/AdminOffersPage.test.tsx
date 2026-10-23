import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminOffersPage } from "@/pages/admin/AdminOffersPage";
import { AdminOffersHistoryPage } from "@/pages/admin/AdminOffersHistoryPage";
import { approveOffer, getUserById, listOffers, listOffersPage, reviewOffer } from "@/services/api";
import { ApiError } from "@/lib/http";
import type { ProductOffer } from "@/types/domain";

vi.mock("@/services/api", () => ({
  listOffers: vi.fn(),
  listOffersPage: vi.fn(),
  getUserById: vi.fn(),
  approveOffer: vi.fn(),
  reviewOffer: vi.fn(),
}));

const mockedListOffers = vi.mocked(listOffers);
const mockedListOffersPage = vi.mocked(listOffersPage);

// One page of the history, as listOffersPage returns it.
function historyPage(items: ProductOffer[], page = 1, pageCount = 1) {
  return { items, total: items.length, page, pageCount };
}
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
    totalWholesalePrice: 120,
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

function renderPage(Page: () => React.JSX.Element, url = "/") {
  render(
    <MemoryRouter initialEntries={[url]}>
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

describe("AdminOffersHistoryPage — total price", () => {
  it("lists each offer's whole-offer price in OMR", async () => {
    mockedListOffersPage.mockResolvedValue(
      historyPage([makeOffer({ _id: "o1", status: "APPROVED", wholeQuantity: 100, totalWholesalePrice: 1000 })]),
    );
    renderPage(AdminOffersHistoryPage);

    expect(await screen.findAllByText("1,000.000 OMR")).not.toHaveLength(0);
    expect(screen.getAllByText("Total price")).not.toHaveLength(0);
  });
});

describe("AdminOffersHistoryPage — offer images", () => {
  it("shows each offer's cover next to its name, or a placeholder", async () => {
    mockedListOffersPage.mockResolvedValue(
      historyPage([
        makeOffer({ _id: "o1", status: "APPROVED" }),
        makeOffer({ _id: "o2", name: "Saffron 1g", status: "REJECTED", images: [] }),
      ]),
    );
    renderPage(AdminOffersHistoryPage);

    const covers = await screen.findAllByAltText("Dates 5kg");
    expect(covers[0]).toHaveAttribute("src", expect.stringContaining("/orderpools/dev/offers/s1/cover"));
    expect(screen.getAllByRole("img", { name: "No product image" }).length).toBeGreaterThan(0);
  });
});

describe("AdminOffersHistoryPage — pagination", () => {
  const history = { status: ["APPROVED", "REJECTED"] };

  it("loads the first page of approved and rejected offers, 20 at a time", async () => {
    mockedListOffersPage.mockResolvedValue(historyPage([makeOffer({ status: "APPROVED" })]));
    renderPage(AdminOffersHistoryPage);

    expect((await screen.findAllByText("Dates 5kg")).length).toBeGreaterThan(0);
    expect(mockedListOffersPage).toHaveBeenCalledWith(history, 1, 20);
    // A single page needs no pager.
    expect(screen.queryByText(/Page \d+ of/)).not.toBeInTheDocument();
  });

  it("moves between pages with Next and Previous", async () => {
    mockedListOffersPage.mockImplementation(async (_filter, page) =>
      historyPage([makeOffer({ _id: `o${page}`, name: `Offer on page ${page}`, status: "APPROVED" })], page, 3),
    );
    renderPage(AdminOffersHistoryPage);

    expect(await screen.findByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Page 2 of 3")).toBeInTheDocument();
    expect((await screen.findAllByText("Offer on page 2")).length).toBeGreaterThan(0);
    expect(mockedListOffersPage).toHaveBeenLastCalledWith(history, 2, 20);

    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(await screen.findByText("Page 1 of 3")).toBeInTheDocument();
    expect(mockedListOffersPage).toHaveBeenLastCalledWith(history, 1, 20);
  });

  it("opens the page named in the URL", async () => {
    mockedListOffersPage.mockImplementation(async (_filter, page) => historyPage([makeOffer()], page, 3));
    renderPage(AdminOffersHistoryPage, "/admin/offers-history?page=2");

    expect(await screen.findByText("Page 2 of 3")).toBeInTheDocument();
    expect(mockedListOffersPage).toHaveBeenCalledWith(history, 2, 20);
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it.each(["0", "-1", "abc", "1.5"])("treats ?page=%s as the first page", async (page) => {
    mockedListOffersPage.mockResolvedValue(historyPage([makeOffer()]));
    renderPage(AdminOffersHistoryPage, `/admin/offers-history?page=${page}`);

    expect((await screen.findAllByText("Dates 5kg")).length).toBeGreaterThan(0);
    expect(mockedListOffersPage).toHaveBeenCalledWith(history, 1, 20);
  });

  // An old link, or offers deleted since the page was bookmarked.
  it("shows the last page instead of an empty one when the URL is past the end", async () => {
    mockedListOffersPage.mockImplementation(async (_filter, page) =>
      historyPage(page <= 2 ? [makeOffer({ name: `Offer on page ${page}` })] : [], page, 2),
    );
    renderPage(AdminOffersHistoryPage, "/admin/offers-history?page=9");

    expect(await screen.findByText("Page 2 of 2")).toBeInTheDocument();
    expect((await screen.findAllByText("Offer on page 2")).length).toBeGreaterThan(0);
    expect(mockedListOffersPage).toHaveBeenLastCalledWith(history, 2, 20);
  });
});

// Reference scenario (order-pools-backend/docs/pricing-model-plan.md):
// 100 units for 1000 OMR, so 25 units cost the supplier 250 OMR.
describe("AdminOffersPage — approving with lot terms", () => {
  const mockedApprove = vi.mocked(approveOffer);
  const user = () => userEvent.setup();

  async function openAccept() {
    mockedListOffers.mockResolvedValue([makeOffer({ wholeQuantity: 100, totalWholesalePrice: 1000 })]);
    renderPage(AdminOffersPage);
    await user().click(await screen.findByRole("button", { name: "Accept" }));
    return screen.getByRole("dialog", { name: "Accept this offer?" });
  }

  const minimumField = (dialog: HTMLElement) => within(dialog).getByLabelText(/Minimum contribution \(units per lot\)/);
  const priceField = (dialog: HTMLElement) => within(dialog).getByLabelText(/Minimum contribution price/);

  it("shows the offer's total price in the review list", async () => {
    mockedListOffers.mockResolvedValue([makeOffer({ wholeQuantity: 100, totalWholesalePrice: 1000 })]);
    renderPage(AdminOffersPage);

    expect(await screen.findByText("1,000.000 OMR")).toBeInTheDocument();
  });

  // R2/R4: nothing is filled in; the break-even is only a placeholder.
  it("shows the break-even as the price's placeholder, never its value", async () => {
    const dialog = await openAccept();

    expect(priceField(dialog)).toHaveValue(null);
    await user().type(minimumField(dialog), "25");

    expect(priceField(dialog)).toHaveAttribute("placeholder", "250.000");
    expect(priceField(dialog)).toHaveValue(null);
    expect(within(dialog).getByText(/Minimum allowed price: 250\.000 OMR/)).toBeInTheDocument();
  });

  it("says the price is required when submitted empty", async () => {
    const dialog = await openAccept();

    await user().type(minimumField(dialog), "25");
    await user().click(within(dialog).getByRole("button", { name: "Accept & create pool" }));

    expect(within(dialog).getByText("Enter the minimum contribution price.")).toBeInTheDocument();
    expect(mockedApprove).not.toHaveBeenCalled();
  });

  it("warns live when the price would put the business below cost", async () => {
    const dialog = await openAccept();

    await user().type(minimumField(dialog), "25");
    await user().type(priceField(dialog), "200");

    expect(
      within(dialog).getByText("Below 250.000 OMR would put the business below cost for 25 units."),
    ).toBeInTheDocument();
    expect(priceField(dialog)).toHaveAttribute("aria-invalid", "true");
    await user().click(within(dialog).getByRole("button", { name: "Accept & create pool" }));
    expect(mockedApprove).not.toHaveBeenCalled();
  });

  it("shows who takes the leftover, as information rather than an error", async () => {
    const dialog = await openAccept();

    await user().type(minimumField(dialog), "30");

    expect(
      within(dialog).getByText("100 isn't a multiple of 30: the last joiner takes 30 + 10 units."),
    ).toBeInTheDocument();
    expect(minimumField(dialog)).not.toHaveAttribute("aria-invalid");
    expect(minimumField(dialog)).toHaveAccessibleDescription(
      "100 isn't a multiple of 30: the last joiner takes 30 + 10 units.",
    );
  });

  it("shows the margin and approves with the lot terms", async () => {
    mockedApprove.mockResolvedValue({ offer: {}, pool: {} } as never);
    const dialog = await openAccept();

    await user().type(minimumField(dialog), "25");
    await user().type(priceField(dialog), "300");
    expect(
      within(dialog).getByText("+50.000 OMR over cost per 25 units (+200.000 OMR on the whole offer)."),
    ).toBeInTheDocument();
    await user().type(within(dialog).getByLabelText(/Pool deadline/), "2030-12-31");
    await user().click(within(dialog).getByRole("button", { name: "Accept & create pool" }));

    expect(mockedApprove).toHaveBeenCalledWith("offer-1", {
      minimumContribution: 25,
      minimumContributionPrice: 300,
      endDate: new Date("2030-12-31").toISOString(),
      adminComment: undefined,
    });
  });

  it("shows the backend's refusal on the field it's about", async () => {
    mockedApprove.mockRejectedValue(
      new ApiError("Validation Error", 400, {
        minimumContributionPrice: [
          "minimumContributionPrice (300.000 OMR) cannot be below the supplier-cost break-even of 400.000 OMR for 25 units",
        ],
      }),
    );
    const dialog = await openAccept();

    await user().type(minimumField(dialog), "25");
    await user().type(priceField(dialog), "300");
    await user().type(within(dialog).getByLabelText(/Pool deadline/), "2030-12-31");
    await user().click(within(dialog).getByRole("button", { name: "Accept & create pool" }));

    expect(await within(dialog).findByText(/break-even of 400\.000 OMR/)).toBeInTheDocument();
    expect(priceField(dialog)).toHaveAttribute("aria-invalid", "true");
    expect(priceField(dialog)).toHaveAccessibleDescription(expect.stringContaining("break-even of 400.000 OMR"));
  });
});

// A notification's link: /admin/offers?offer=<id>.
describe("AdminOffersPage — opened from a notification", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    delete (Element.prototype as Partial<Element>).scrollIntoView;
  });

  function renderAt(url: string) {
    render(
      <MemoryRouter initialEntries={[url]}>
        <AdminOffersPage />
      </MemoryRouter>,
    );
  }

  const offerCard = (name: string) => screen.getByRole("heading", { name }).closest("[class*=rounded-xl]");

  it("highlights the offer to review and scrolls to it", async () => {
    mockedListOffers.mockResolvedValue([
      makeOffer({ _id: "offer-1", name: "Dates 5kg" }),
      makeOffer({ _id: "offer-2", name: "Rice 25kg" }),
    ]);
    renderAt("/admin/offers?offer=offer-2");

    await screen.findByRole("heading", { name: "Rice 25kg" });

    expect(offerCard("Rice 25kg")).toHaveAttribute("data-linked-item");
    expect(offerCard("Dates 5kg")).not.toHaveAttribute("data-linked-item");
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("says when the offer was already decided on, pointing to the history", async () => {
    mockedListOffers.mockResolvedValue([makeOffer()]);
    renderAt("/admin/offers?offer=decided-offer");

    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent("This offer isn't awaiting review any more");
    expect(within(notice).getByRole("link", { name: "Offers History" })).toHaveAttribute(
      "href",
      "/admin/offers-history",
    );
  });

  it("doesn't say so after the admin decides on it here", async () => {
    mockedListOffers.mockResolvedValueOnce([makeOffer()]).mockResolvedValue([]);
    vi.mocked(reviewOffer).mockResolvedValue(makeOffer({ status: "REJECTED" }));
    renderAt("/admin/offers?offer=offer-1");

    await userEvent.click(await screen.findByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/Note to supplier/), "Price above market");
    await userEvent.click(within(dialog).getByRole("button", { name: "Reject offer" }));

    expect(await screen.findByText("No offers awaiting review")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
