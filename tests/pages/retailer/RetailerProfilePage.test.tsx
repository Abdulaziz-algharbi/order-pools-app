import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RetailerProfilePage } from "@/pages/retailer/RetailerProfilePage";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/services/api";
import { ApiError } from "@/lib/http";
import type { AppUser, SupplierRequest } from "@/types/domain";

vi.mock("@/context/AuthContext", () => ({ useAuth: vi.fn() }));

vi.mock("@/services/api", () => ({
  createSupplierRequest: vi.fn(),
  listMyAddresses: vi.fn(),
  listSupplierRequests: vi.fn(),
  listSupplierRemoveRequests: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedApi = vi.mocked(api);
const refreshUser = vi.fn();

const retailer: AppUser = {
  _id: "retailer-1",
  firstName: "Aisha",
  lastName: "Said",
  email: "aisha@example.com",
  phoneNumber: "+96890000000",
  companyName: "Said Trading",
  roles: ["RETAILER"],
  addresses: [],
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

function request(overrides: Partial<SupplierRequest>): SupplierRequest {
  return {
    _id: "req-1",
    user_ref: "retailer-1",
    description: "Wholesale rice",
    commercialRegistration: "1234567",
    vatNumber: null,
    status: "PENDING",
    adminComment: null,
    createdAt: "2026-09-20T00:00:00.000Z",
    updatedAt: "2026-09-20T00:00:00.000Z",
    ...overrides,
  };
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/retailer/profile"]}>
      <Routes>
        <Route path="/retailer/profile" element={<RetailerProfilePage />} />
        <Route path="/supplier" element={<p>Supplier panel</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedUseAuth.mockReturnValue({
    user: retailer,
    isLoading: false,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    refreshUser,
    updateProfile: vi.fn(),
    removeAccount: vi.fn(),
  });
  mockedApi.listMyAddresses.mockResolvedValue([]);
  mockedApi.listSupplierRemoveRequests.mockResolvedValue([]);
});

describe("RetailerProfilePage — supplier request outcome", () => {
  it("shows the admin's note on a rejected request and lets the retailer request again", async () => {
    mockedApi.listSupplierRequests.mockResolvedValue([
      request({ status: "REJECTED", adminComment: "Add your CR number first." }),
    ]);

    renderPage();

    expect(await screen.findByText("Add your CR number first.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request again" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open supplier panel" })).not.toBeInTheDocument();
  });

  it("offers no supplier-panel action while the request is still pending", async () => {
    mockedApi.listSupplierRequests.mockResolvedValue([request({ status: "PENDING" })]);

    renderPage();

    expect(await screen.findByText("Your request to also become a supplier:")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open supplier panel" })).not.toBeInTheDocument();
  });

  it("re-reads the account on an approved request and opens the supplier panel", async () => {
    mockedApi.listSupplierRequests.mockResolvedValue([request({ status: "APPROVED" })]);
    refreshUser.mockResolvedValue({ ...retailer, roles: ["RETAILER", "SUPPLIER"] });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Open supplier panel" }));

    expect(refreshUser).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Supplier panel")).toBeInTheDocument();
  });

  it("stays put and explains when the account does not hold SUPPLIER yet", async () => {
    mockedApi.listSupplierRequests.mockResolvedValue([request({ status: "APPROVED" })]);
    refreshUser.mockResolvedValue(retailer);
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Open supplier panel" }));

    expect(await screen.findByText(/Supplier access isn't active on your account yet/)).toBeInTheDocument();
    expect(screen.queryByText("Supplier panel")).not.toBeInTheDocument();
  });

  it("shows the backend's reason when re-reading the account fails", async () => {
    mockedApi.listSupplierRequests.mockResolvedValue([request({ status: "APPROVED" })]);
    refreshUser.mockRejectedValue(new ApiError("Access token is missing", 401));
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Open supplier panel" }));

    expect(await screen.findByText("Access token is missing")).toBeInTheDocument();
  });

  it("hides the whole supplier-request card once the account is a supplier", async () => {
    mockedUseAuth.mockReturnValue({
      ...mockedUseAuth(),
      user: { ...retailer, roles: ["RETAILER", "SUPPLIER"] },
    });
    mockedApi.listSupplierRequests.mockResolvedValue([request({ status: "APPROVED" })]);

    renderPage();

    await screen.findByText("Said Trading");
    expect(screen.queryByText("Become a supplier")).not.toBeInTheDocument();
  });
});

describe("RetailerProfilePage — filing a supplier request", () => {
  function signInAs(overrides: Partial<AppUser>) {
    mockedUseAuth.mockReturnValue({ ...mockedUseAuth(), user: { ...retailer, ...overrides } });
  }

  async function openForm(buttonName: string) {
    await userEvent.click(await screen.findByRole("button", { name: buttonName }));
    return screen.getByRole("dialog");
  }

  const field = (dialog: HTMLElement, label: RegExp) => within(dialog).getByLabelText(label);

  beforeEach(() => {
    mockedApi.listSupplierRequests.mockResolvedValue([]);
    mockedApi.createSupplierRequest.mockResolvedValue(request({}));
  });

  it("pre-fills the identifiers already on the profile and submits them with the description", async () => {
    signInAs({ commercialRegistration: "1234567", vatNumber: "OM1100012345" });
    renderPage();

    const dialog = await openForm("Request supplier access");
    expect(field(dialog, /Commercial registration/)).toHaveValue("1234567");
    expect(field(dialog, /VAT number/)).toHaveValue("OM1100012345");
    await userEvent.type(field(dialog, /About your business/), "  Wholesale rice importer  ");
    await userEvent.click(within(dialog).getByRole("button", { name: "Submit request" }));

    expect(mockedApi.createSupplierRequest).toHaveBeenCalledWith({
      description: "Wholesale rice importer",
      commercialRegistration: "1234567",
      vatNumber: "OM1100012345",
    });
    expect(mockedApi.listSupplierRequests).toHaveBeenCalledTimes(2);
  });

  it("leaves vatNumber out when the retailer has none", async () => {
    renderPage();

    const dialog = await openForm("Request supplier access");
    await userEvent.type(field(dialog, /About your business/), "Spice trader");
    await userEvent.type(field(dialog, /Commercial registration/), "7654321");
    await userEvent.type(field(dialog, /VAT number/), "   ");
    await userEvent.click(within(dialog).getByRole("button", { name: "Submit request" }));

    expect(mockedApi.createSupplierRequest).toHaveBeenCalledWith({
      description: "Spice trader",
      commercialRegistration: "7654321",
    });
  });

  it("requires a commercial registration number before submitting", async () => {
    renderPage();

    const dialog = await openForm("Request supplier access");
    await userEvent.type(field(dialog, /About your business/), "Spice trader");
    await userEvent.click(within(dialog).getByRole("button", { name: "Submit request" }));

    expect(within(dialog).getByText("Please enter your commercial registration number.")).toBeInTheDocument();
    expect(mockedApi.createSupplierRequest).not.toHaveBeenCalled();
  });

  it("requires a description before submitting", async () => {
    signInAs({ commercialRegistration: "1234567" });
    renderPage();

    const dialog = await openForm("Request supplier access");
    await userEvent.click(within(dialog).getByRole("button", { name: "Submit request" }));

    expect(within(dialog).getByText("Please describe your business.")).toBeInTheDocument();
    expect(mockedApi.createSupplierRequest).not.toHaveBeenCalled();
  });

  it("pre-fills a repeat request from the rejected one, so only what the admin flagged needs changing", async () => {
    signInAs({ commercialRegistration: "profile-cr" });
    mockedApi.listSupplierRequests.mockResolvedValue([
      request({
        status: "REJECTED",
        description: "Rice importer",
        commercialRegistration: "1234567",
        vatNumber: "OM1100012345",
        adminComment: "CR number looks wrong.",
      }),
    ]);
    renderPage();

    const dialog = await openForm("Request again");

    expect(field(dialog, /About your business/)).toHaveValue("Rice importer");
    expect(field(dialog, /Commercial registration/)).toHaveValue("1234567");
    expect(field(dialog, /VAT number/)).toHaveValue("OM1100012345");
  });

  it("keeps the form open and shows the backend's reason when submitting fails", async () => {
    signInAs({ commercialRegistration: "1234567" });
    mockedApi.createSupplierRequest.mockRejectedValue(
      new ApiError("This conflicts with an existing record", 409),
    );
    renderPage();

    const dialog = await openForm("Request supplier access");
    await userEvent.type(field(dialog, /About your business/), "Spice trader");
    await userEvent.click(within(dialog).getByRole("button", { name: "Submit request" }));

    expect(await within(dialog).findByText("This conflicts with an existing record")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
