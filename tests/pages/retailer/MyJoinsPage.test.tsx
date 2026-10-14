import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MyJoinsPage } from "@/pages/retailer/MyJoinsPage";
import * as api from "@/services/api";
import { makeParticipant, makePayment, makePool } from "../../fixtures/pools";

vi.mock("@/services/api", () => ({
  listMyParticipants: vi.fn(),
  listPools: vi.fn(),
  listMyPayments: vi.fn(),
  withdrawParticipant: vi.fn(),
  cancelPayment: vi.fn(),
}));

const mockedApi = vi.mocked(api);

// Two joins on OPEN pools: one paid and active, one already withdrawn.
const activePool = makePool({ _id: "pool-1", productName: "Basmati Rice 25kg" });
const leftPool = makePool({ _id: "pool-2", productName: "Olive Oil 5L" });

// DataTable renders both a table and mobile cards; scope to the table row.
function tableRow(productName: string) {
  const row = screen.getAllByRole("row").find((r) => within(r).queryByText(productName));
  if (!row) throw new Error(`No table row for ${productName}`);
  return row;
}

async function renderPage(url = "/retailer/joins") {
  render(
    <MemoryRouter initialEntries={[url]}>
      <MyJoinsPage />
    </MemoryRouter>,
  );
  await screen.findAllByText("Olive Oil 5L");
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedApi.listPools.mockResolvedValue([activePool, leftPool]);
  mockedApi.listMyPayments.mockResolvedValue([]);
  mockedApi.listMyParticipants.mockResolvedValue([
    makeParticipant({ _id: "participant-1", pool_ref: "pool-1", status: "WAITING" }),
    makeParticipant({ _id: "participant-2", pool_ref: "pool-2", status: "WITHDRAWN" }),
  ]);
  mockedApi.withdrawParticipant.mockResolvedValue(undefined);
});

describe("MyJoinsPage — withdrawn joins", () => {
  it("keeps a withdrawn join in the list, labelled Withdrawn, with no Leave button", async () => {
    await renderPage();

    const row = tableRow("Olive Oil 5L");
    expect(within(row).getByText("Withdrawn")).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "Leave" })).not.toBeInTheDocument();
  });

  it("shows the withdrawn join's refund once it completes", async () => {
    mockedApi.listMyPayments.mockResolvedValue([
      makePayment({ _id: "payment-2", poolParticipant_ref: "participant-2", status: "REFUNDED" }),
    ]);
    mockedApi.listMyParticipants.mockResolvedValue([
      makeParticipant({ _id: "participant-2", pool_ref: "pool-2", payment_ref: "payment-2", status: "WITHDRAWN" }),
    ]);

    await renderPage();

    expect(within(tableRow("Olive Oil 5L")).getByText("Withdrawn · Refunded")).toBeInTheDocument();
  });

  it("still lets an active join leave the pool", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(within(tableRow("Basmati Rice 25kg")).getByRole("button", { name: "Leave" }));
    await user.click(screen.getByRole("button", { name: "Leave pool" }));

    expect(mockedApi.withdrawParticipant).toHaveBeenCalledWith("participant-1");
  });
});

describe("MyJoinsPage — totals", () => {
  // Fixture: lots of 5 at 60 OMR; the join takes 10 (two lots).
  it("shows what each join costs in OMR", async () => {
    await renderPage();

    expect(within(tableRow("Basmati Rice 25kg")).getByText("120.000 OMR")).toBeInTheDocument();
  });
});

// A payment notification's link: /retailer/joins?pool=<id>.
describe("MyJoinsPage — opened from a notification", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    delete (Element.prototype as Partial<Element>).scrollIntoView;
  });

  it("highlights the join in that pool, in the table and the mobile cards", async () => {
    await renderPage("/retailer/joins?pool=pool-1");

    expect(tableRow("Basmati Rice 25kg")).toHaveAttribute("data-linked-item");
    expect(tableRow("Olive Oil 5L")).not.toHaveAttribute("data-linked-item");
    // The row and its mobile card: the hook scrolls to whichever shows.
    expect(document.querySelectorAll("[data-linked-item]")).toHaveLength(2);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("says when there's no join in that pool", async () => {
    await renderPage("/retailer/joins?pool=pool-unknown");

    expect(screen.getByRole("status")).toHaveTextContent("That pool isn't in your joins any more.");
  });
});
