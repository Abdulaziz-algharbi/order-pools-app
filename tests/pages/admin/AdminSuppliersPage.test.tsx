import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminSuppliersPage } from "@/pages/admin/AdminSuppliersPage";
import * as api from "@/services/api";
import { ApiError } from "@/lib/http";
import type { AppUser, SupplierRequest } from "@/types/domain";

vi.mock("@/services/api", () => ({
  createSupplierAccount: vi.fn(),
  decideSupplierRemoveRequest: vi.fn(),
  decideSupplierRequest: vi.fn(),
  deleteUser: vi.fn(),
  getUserById: vi.fn(),
  listSupplierRemoveRequests: vi.fn(),
  listSupplierRequests: vi.fn(),
  listSuppliers: vi.fn(),
}));

const mockedApi = vi.mocked(api);

const pendingRequest: SupplierRequest = {
  _id: "req-1",
  user_ref: "retailer-1",
  description: "We import basmati rice by the container.",
  commercialRegistration: "1234567",
  vatNumber: "OM1100012345",
  status: "PENDING",
  adminComment: null,
  createdAt: "2026-09-20T00:00:00.000Z",
  updatedAt: "2026-09-20T00:00:00.000Z",
};

const requester = {
  _id: "retailer-1",
  companyName: "Said Trading",
} as AppUser;

beforeEach(() => {
  vi.resetAllMocks();
  mockedApi.listSuppliers.mockResolvedValue([]);
  mockedApi.listSupplierRemoveRequests.mockResolvedValue([]);
  mockedApi.listSupplierRequests.mockResolvedValue([pendingRequest]);
  mockedApi.getUserById.mockResolvedValue(requester);
});

async function renderPage() {
  render(<AdminSuppliersPage />);
  await screen.findByText("Said Trading");
}

async function openRejectModal() {
  await userEvent.click(screen.getByRole("button", { name: "Reject" }));
  return screen.getByRole("dialog");
}

describe("AdminSuppliersPage — reviewing supplier requests", () => {
  it("shows the business identifiers the retailer submitted", async () => {
    await renderPage();

    expect(screen.getByText("1234567")).toBeInTheDocument();
    expect(screen.getByText("OM1100012345")).toBeInTheDocument();
  });

  it("marks identifiers missing from a request filed before they were collected", async () => {
    mockedApi.listSupplierRequests.mockResolvedValue([
      { ...pendingRequest, commercialRegistration: null, vatNumber: null },
    ]);
    await renderPage();

    expect(screen.getAllByText("Not provided")).toHaveLength(2);
  });

  it("rejects with the admin's note so the retailer knows what to change", async () => {
    mockedApi.decideSupplierRequest.mockResolvedValue({ ...pendingRequest, status: "REJECTED" });
    await renderPage();

    const dialog = await openRejectModal();
    expect(within(dialog).getByText(/Said Trading will be notified/)).toBeInTheDocument();
    await userEvent.type(
      within(dialog).getByLabelText(/Note to the retailer/),
      "  Please add your CR number first.  ",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Reject request" }));

    expect(mockedApi.decideSupplierRequest).toHaveBeenCalledWith("req-1", {
      status: "REJECTED",
      adminComment: "Please add your CR number first.",
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mockedApi.listSupplierRequests).toHaveBeenCalledTimes(2);
  });

  it("rejects without an adminComment when the note is left blank", async () => {
    mockedApi.decideSupplierRequest.mockResolvedValue({ ...pendingRequest, status: "REJECTED" });
    await renderPage();

    const dialog = await openRejectModal();
    await userEvent.type(within(dialog).getByLabelText(/Note to the retailer/), "   ");
    await userEvent.click(within(dialog).getByRole("button", { name: "Reject request" }));

    expect(mockedApi.decideSupplierRequest).toHaveBeenCalledWith("req-1", { status: "REJECTED" });
  });

  it("does not reject anything when the modal is cancelled", async () => {
    await renderPage();

    const dialog = await openRejectModal();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mockedApi.decideSupplierRequest).not.toHaveBeenCalled();
  });

  it("keeps the modal open and shows the backend's reason when rejecting fails", async () => {
    mockedApi.decideSupplierRequest.mockRejectedValue(
      new ApiError("Only a PENDING request can be reviewed", 409),
    );
    await renderPage();

    const dialog = await openRejectModal();
    await userEvent.click(within(dialog).getByRole("button", { name: "Reject request" }));

    expect(await within(dialog).findByText("Only a PENDING request can be reviewed")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("starts each rejection with an empty note", async () => {
    await renderPage();

    let dialog = await openRejectModal();
    await userEvent.type(within(dialog).getByLabelText(/Note to the retailer/), "draft");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    dialog = await openRejectModal();

    expect(within(dialog).getByLabelText(/Note to the retailer/)).toHaveValue("");
  });

  it("approves directly and refreshes both the requests and the supplier list", async () => {
    mockedApi.decideSupplierRequest.mockResolvedValue({ ...pendingRequest, status: "APPROVED" });
    await renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Approve" }));

    expect(mockedApi.decideSupplierRequest).toHaveBeenCalledWith("req-1", { status: "APPROVED" });
    await waitFor(() => expect(mockedApi.listSuppliers).toHaveBeenCalledTimes(2));
    expect(mockedApi.listSupplierRequests).toHaveBeenCalledTimes(2);
  });

  it("shows the backend's reason when approving fails", async () => {
    mockedApi.decideSupplierRequest.mockRejectedValue(
      new ApiError("Only a PENDING request can be reviewed", 409),
    );
    await renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Approve" }));

    expect(await screen.findByText("Only a PENDING request can be reviewed")).toBeInTheDocument();
  });
});
