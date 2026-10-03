import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupplierOfferDetailPage } from "@/pages/supplier/SupplierOfferDetailPage";
import { useAuth } from "@/context/AuthContext";
import { getOffer, updateOwnOffer, uploadImage } from "@/services/api";
import type { ImageRef, ProductOffer, UploadedImage } from "@/types/domain";
import { authValue, makeUser } from "../../fixtures/auth";

vi.mock("@/context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/services/api", () => ({
  getOffer: vi.fn(),
  updateOwnOffer: vi.fn(),
  deleteOffer: vi.fn(),
  uploadImage: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedGetOffer = vi.mocked(getOffer);
const mockedUpdate = vi.mocked(updateOwnOffer);
const mockedUpload = vi.mocked(uploadImage);

const stored = (name: string): ImageRef => ({ publicId: `orderpools/dev/offers/s1/${name}`, version: 1 });
const uploaded = (name: string): UploadedImage => ({ ...stored(name), signature: "s" });

function makeOffer(overrides: Partial<ProductOffer> = {}): ProductOffer {
  return {
    _id: "offer-1",
    user_ref: "s1",
    name: "Dates 5kg",
    description: "Khalas dates",
    brand: null,
    unit: "BOX",
    images: [stored("cover"), stored("side")],
    wholeQuantity: 40,
    price: 3,
    status: "PENDING",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/supplier/offers/offer-1"]}>
      <Routes>
        <Route path="/supplier/offers/:offerId" element={<SupplierOfferDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const user = () => userEvent.setup({ applyAccept: false });

beforeEach(() => {
  vi.resetAllMocks();
  mockedUseAuth.mockReturnValue(authValue(makeUser({ roles: ["SUPPLIER"], isVerified: true })));
  mockedGetOffer.mockResolvedValue(makeOffer());
  mockedUpdate.mockResolvedValue(makeOffer());
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

async function openEdit() {
  renderPage();
  await user().click(await screen.findByRole("button", { name: "Edit offer" }));
  return screen.getByRole("dialog");
}

describe("SupplierOfferDetailPage — images", () => {
  it("shows the offer's images, cover first", async () => {
    renderPage();

    expect(await screen.findByAltText("Dates 5kg, image 1 of 2")).toHaveAttribute(
      "src",
      expect.stringContaining("/orderpools/dev/offers/s1/cover"),
    );
  });

  it("shows no gallery for an offer without images", async () => {
    mockedGetOffer.mockResolvedValue(makeOffer({ images: [] }));
    renderPage();

    await screen.findByText("Khalas dates");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("saves the current images unchanged with an edit that doesn't touch them", async () => {
    const dialog = await openEdit();

    await user().click(within(dialog).getByRole("button", { name: "Save" }));

    expect(mockedUpdate).toHaveBeenCalledWith(
      "offer-1",
      expect.objectContaining({ images: [stored("cover"), stored("side")] }),
    );
  });

  it("keeps existing images, reordered, alongside a new upload", async () => {
    mockedUpload.mockResolvedValue(uploaded("new"));
    const dialog = await openEdit();

    await user().click(within(dialog).getByRole("button", { name: "Set image 2 as cover" }));
    await user().upload(within(dialog).getByLabelText("Product images"), new File(["x"], "new.png", { type: "image/png" }));
    await within(dialog).findByAltText("Image 3");
    await user().click(within(dialog).getByRole("button", { name: "Save" }));

    expect(mockedUpload).toHaveBeenCalledWith(expect.any(File), "offer", expect.any(Object));
    expect(mockedUpdate).toHaveBeenCalledWith(
      "offer-1",
      expect.objectContaining({ images: [stored("side"), stored("cover"), uploaded("new")] }),
    );
  });

  it("removes an image", async () => {
    const dialog = await openEdit();

    await user().click(within(dialog).getByRole("button", { name: "Remove image 1" }));
    await user().click(within(dialog).getByRole("button", { name: "Save" }));

    expect(mockedUpdate).toHaveBeenCalledWith("offer-1", expect.objectContaining({ images: [stored("side")] }));
  });

  it("holds Save while an image is still uploading", async () => {
    let finish!: (image: UploadedImage) => void;
    mockedUpload.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const dialog = await openEdit();

    await user().upload(within(dialog).getByLabelText("Product images"), new File(["x"], "a.png", { type: "image/png" }));
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled();

    await act(async () => finish(uploaded("a")));
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("doesn't let an unverified supplier change images, saying why", async () => {
    mockedUseAuth.mockReturnValue(authValue(makeUser({ roles: ["SUPPLIER"], isVerified: false })));
    const dialog = await openEdit();

    expect(within(dialog).getByLabelText("Product images")).toBeDisabled();
    expect(within(dialog).getByText("Verify your email address to change the images.")).toBeInTheDocument();
  });

  it("can't be edited once approved", async () => {
    mockedGetOffer.mockResolvedValue(makeOffer({ status: "APPROVED" }));
    renderPage();

    await screen.findByText("Khalas dates");
    expect(screen.queryByRole("button", { name: "Edit offer" })).not.toBeInTheDocument();
  });
});
