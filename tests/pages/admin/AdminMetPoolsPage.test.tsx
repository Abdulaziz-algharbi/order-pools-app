import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminMetPoolsPage } from "@/pages/admin/AdminMetPoolsPage";
import { createDelivery, listPools } from "@/services/api";
import type { Delivery } from "@/types/domain";
import { makePool } from "../../fixtures/pools";

vi.mock("@/services/api", () => ({
  listPools: vi.fn(),
  createDelivery: vi.fn(),
}));

const mockedListPools = vi.mocked(listPools);

const rice = makePool({ _id: "pool-1", productName: "Basmati Rice 25kg", status: "TARGET_REACHED" });
const oil = makePool({ _id: "pool-2", productName: "Olive Oil 5L", status: "TARGET_REACHED" });

function renderAt(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <AdminMetPoolsPage />
    </MemoryRouter>,
  );
}

const poolCard = (name: string) => screen.getByRole("heading", { name }).closest("[class*=rounded-xl]");

beforeEach(() => {
  vi.resetAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  mockedListPools.mockResolvedValue([rice, oil]);
});

afterEach(() => {
  delete (Element.prototype as Partial<Element>).scrollIntoView;
});

// A POOL_TARGET_REACHED notification's link: /admin/met-pools?pool=<id>.
describe("AdminMetPoolsPage — opened from a notification", () => {
  it("highlights the full pool and scrolls to it", async () => {
    renderAt("/admin/met-pools?pool=pool-2");

    await screen.findByRole("heading", { name: "Olive Oil 5L" });

    expect(poolCard("Olive Oil 5L")).toHaveAttribute("data-linked-item");
    expect(poolCard("Basmati Rice 25kg")).not.toHaveAttribute("data-linked-item");
    // The scroll runs in an effect after the render that marks the card,
    // which a slow runner can still be flushing here.
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
  });

  it("says when its delivery was already started, pointing to Track Pools", async () => {
    renderAt("/admin/met-pools?pool=pool-delivering");

    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent("This pool isn't waiting for delivery any more");
    expect(within(notice).getByRole("link", { name: "Track Pools" })).toHaveAttribute("href", "/admin/track");
  });

  it("doesn't say so after the admin starts its delivery here", async () => {
    mockedListPools.mockResolvedValueOnce([rice]).mockResolvedValue([]);
    vi.mocked(createDelivery).mockResolvedValue({ _id: "d-1" } as Delivery);
    renderAt("/admin/met-pools?pool=pool-1");

    await userEvent.click(await screen.findByRole("button", { name: "Start delivery" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Start delivery" }));

    expect(await screen.findByText("No pools awaiting delivery")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
