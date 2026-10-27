import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPaymentsPage } from "@/pages/admin/AdminPaymentsPage";
import { getUserById, listPayments, listPools, retryRefund } from "@/services/api";
import { ApiError } from "@/lib/http";
import type { AppUser, Payment } from "@/types/domain";
import { makePayment, makePool } from "../../fixtures/pools";

vi.mock("@/services/api", () => ({
  confirmRefund: vi.fn(),
  getUserById: vi.fn(),
  listPayments: vi.fn(),
  listPools: vi.fn(),
  retryRefund: vi.fn(),
}));

const mockedListPayments = vi.mocked(listPayments);

const failed = makePayment({ _id: "pay-1", user_ref: "user-1", status: "REFUND_FAILED" });
const otherFailed = makePayment({ _id: "pay-2", user_ref: "user-2", status: "REFUND_FAILED" });

function renderAt(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <AdminPaymentsPage />
    </MemoryRouter>,
  );
}

// DataTable renders each payment as a table row and as a mobile card.
const linkedRows = () => document.querySelectorAll("[data-linked-item]");

beforeEach(() => {
  vi.resetAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  mockedListPayments.mockResolvedValue([failed, otherFailed]);
  vi.mocked(listPools).mockResolvedValue([makePool({ _id: "pool-1", productName: "Basmati Rice 25kg" })]);
  vi.mocked(getUserById).mockImplementation(
    async (id) => ({ _id: id, companyName: id === "user-1" ? "Said Trading" : "Nizwa Mart" }) as AppUser,
  );
});

afterEach(() => {
  delete (Element.prototype as Partial<Element>).scrollIntoView;
});

// A PAYMENT_REFUND_FAILED notification's link: /admin/payments?payment=<id>.
describe("AdminPaymentsPage — opened from a notification", () => {
  it("highlights the refund to retry and scrolls to it", async () => {
    renderAt("/admin/payments?payment=pay-1");

    await screen.findAllByText("Said Trading");

    expect(linkedRows().length).toBeGreaterThan(0);
    for (const row of linkedRows()) {
      expect(row).toHaveTextContent("Said Trading");
      expect(within(row as HTMLElement).getByRole("button", { name: "Retry refund" })).toBeInTheDocument();
    }
    // Scrolled from an effect, which a slow runner can still be flushing here.
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("says when the refund was already retried", async () => {
    mockedListPayments.mockResolvedValue([{ ...failed, status: "REFUND_PENDING" }, otherFailed]);
    renderAt("/admin/payments?payment=pay-1");

    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent("This refund isn't waiting for a retry any more");
    expect(linkedRows()).toHaveLength(0);
  });

  it("keeps it highlighted, without the notice, after the admin retries it here", async () => {
    mockedListPayments
      .mockResolvedValueOnce([failed, otherFailed])
      .mockResolvedValue([{ ...failed, status: "REFUND_PENDING" } as Payment, otherFailed]);
    vi.mocked(retryRefund).mockResolvedValue({ ...failed, status: "REFUND_PENDING" });
    renderAt("/admin/payments?payment=pay-1");

    await screen.findAllByText("Said Trading");
    const row = linkedRows()[0] as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: "Retry refund" }));

    expect(retryRefund).toHaveBeenCalledWith("pay-1");
    expect((await screen.findAllByRole("button", { name: "Confirm refunded" })).length).toBeGreaterThan(0);
    expect(linkedRows().length).toBeGreaterThan(0);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("AdminPaymentsPage — a refused retry", () => {
  const retryButtonFor = async (company: string) => {
    await screen.findAllByText(company);
    const row = screen.getByRole("row", { name: new RegExp(company) });
    return within(row).getByRole("button", { name: "Retry refund" });
  };

  it("says why, naming the retailer, and reloads the list", async () => {
    vi.mocked(retryRefund).mockRejectedValue(new ApiError("Thawani: refund amount exceeds the paid amount", 502));
    renderAt("/admin/payments");

    await userEvent.click(await retryButtonFor("Said Trading"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't retry the refund for Said Trading: Thawani: refund amount exceeds the paid amount",
    );
    expect(mockedListPayments).toHaveBeenCalledTimes(2);
  });

  it("clears the message once a retry goes through", async () => {
    vi.mocked(retryRefund)
      .mockRejectedValueOnce(new ApiError("The payment provider rejected the refund retry", 502))
      .mockResolvedValue({ ...failed, status: "REFUND_PENDING" });
    renderAt("/admin/payments");

    await userEvent.click(await retryButtonFor("Said Trading"));
    await screen.findByRole("alert");
    await userEvent.click(await retryButtonFor("Said Trading"));

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });
});
