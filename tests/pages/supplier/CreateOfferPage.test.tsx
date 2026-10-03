import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateOfferPage } from "@/pages/supplier/CreateOfferPage";
import { useAuth } from "@/context/AuthContext";
import { createOffer, uploadImage } from "@/services/api";
import type { UploadedImage } from "@/types/domain";
import { authValue, makeUser } from "../../fixtures/auth";

vi.mock("@/context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/services/api", () => ({ createOffer: vi.fn(), uploadImage: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);
const mockedCreateOffer = vi.mocked(createOffer);
const mockedUpload = vi.mocked(uploadImage);

function renderPage() {
  render(
    <MemoryRouter>
      <CreateOfferPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("CreateOfferPage — email verification gate", () => {
  it("lets a verified supplier submit", () => {
    mockedUseAuth.mockReturnValue(authValue(makeUser({ roles: ["SUPPLIER"], isVerified: true })));

    renderPage();

    expect(screen.getByRole("button", { name: "Submit offer" })).toBeEnabled();
  });

  it("disables submitting for an unverified supplier and explains why", () => {
    mockedUseAuth.mockReturnValue(authValue(makeUser({ roles: ["SUPPLIER"], isVerified: false })));

    renderPage();

    expect(screen.getByRole("button", { name: "Submit offer" })).toBeDisabled();
    expect(screen.getByText(/Verify your email address to submit an offer/)).toBeInTheDocument();
  });
});

describe("CreateOfferPage — product images", () => {
  const image = (name: string): UploadedImage => ({
    publicId: `orderpools/dev/offers/u1/${name}`,
    version: 1,
    signature: "s",
  });
  const png = (name: string) => new File(["x"], name, { type: "image/png" });
  const user = () => userEvent.setup({ applyAccept: false });

  beforeEach(() => {
    mockedUseAuth.mockReturnValue(authValue(makeUser({ roles: ["SUPPLIER"], isVerified: true })));
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
  });

  async function fillRequiredFields() {
    await user().type(screen.getByLabelText(/Product name/), "Dates 5kg");
    await user().type(screen.getByLabelText(/Description/), "Khalas dates");
    await user().type(screen.getByLabelText(/Quantity/), "40");
    await user().type(screen.getByLabelText(/Price per unit/), "3");
  }

  it("uploads offer images and sends them with the offer, the chosen cover first", async () => {
    mockedUpload.mockResolvedValueOnce(image("a")).mockResolvedValueOnce(image("b"));
    mockedCreateOffer.mockResolvedValue({} as never);
    renderPage();

    await user().upload(screen.getByLabelText("Product images"), [png("a.png"), png("b.png")]);
    expect(mockedUpload).toHaveBeenCalledWith(expect.any(File), "offer", expect.any(Object));
    await user().click(await screen.findByRole("button", { name: "Set image 2 as cover" }));
    await fillRequiredFields();
    await user().click(screen.getByRole("button", { name: "Submit offer" }));

    expect(mockedCreateOffer).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Dates 5kg", images: [image("b"), image("a")] }),
    );
  });

  it("sends no images when none were added", async () => {
    mockedCreateOffer.mockResolvedValue({} as never);
    renderPage();

    await fillRequiredFields();
    await user().click(screen.getByRole("button", { name: "Submit offer" }));

    expect(mockedCreateOffer).toHaveBeenCalledWith(expect.objectContaining({ images: [] }));
  });

  it("holds the submit while an image is still uploading", async () => {
    let finish!: (image: UploadedImage) => void;
    mockedUpload.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderPage();

    await user().upload(screen.getByLabelText("Product images"), png("a.png"));

    expect(screen.getByRole("button", { name: "Submit offer" })).toBeDisabled();
    expect(screen.getByText("Waiting for images to finish uploading…")).toBeInTheDocument();

    await act(async () => finish(image("a")));
    expect(screen.getByRole("button", { name: "Submit offer" })).toBeEnabled();
  });

  // The backend only signs uploads for a verified supplier.
  it("doesn't let an unverified supplier upload images", () => {
    mockedUseAuth.mockReturnValue(authValue(makeUser({ roles: ["SUPPLIER"], isVerified: false })));
    renderPage();

    expect(screen.getByLabelText("Product images")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add images" })).toBeDisabled();
  });

  it("allows up to 10 images", () => {
    renderPage();

    expect(screen.getByText("0 of 10 · JPG, PNG or WebP, up to 5 MB each")).toBeInTheDocument();
  });
});

