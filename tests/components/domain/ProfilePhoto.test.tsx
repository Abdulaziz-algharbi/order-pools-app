import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfilePhoto } from "@/components/domain/ProfilePhoto";
import { useAuth } from "@/context/AuthContext";
import { uploadImage } from "@/services/api";
import { ApiError } from "@/lib/http";
import { authValue, makeUser } from "../../fixtures/auth";

vi.mock("@/context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/services/api", () => ({ uploadImage: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUpload = vi.mocked(uploadImage);
const updateProfile = vi.fn();

const photo = { publicId: "orderpools/dev/profiles/user-1/me", version: 1 };
const uploaded = { ...photo, signature: "s" };
const png = (name = "me.png") => new File(["x"], name, { type: "image/png" });
const user = () => userEvent.setup({ applyAccept: false });

function signIn(profileImage: typeof photo | null) {
  mockedUseAuth.mockReturnValue(authValue(makeUser({ profileImage }), { updateProfile }));
}

beforeEach(() => {
  vi.resetAllMocks();
  updateProfile.mockResolvedValue(makeUser());
});

describe("ProfilePhoto", () => {
  it("uploads a picked photo as a profile image and saves it on the account", async () => {
    signIn(null);
    mockedUpload.mockResolvedValue(uploaded);
    render(<ProfilePhoto />);

    await user().upload(screen.getByLabelText("Profile photo"), png());

    expect(mockedUpload).toHaveBeenCalledWith(expect.objectContaining({ name: "me.png" }), "profile");
    expect(updateProfile).toHaveBeenCalledWith({ profileImage: uploaded });
  });

  it("offers Upload without a photo, and Change and Remove with one", () => {
    signIn(null);
    const { unmount } = render(<ProfilePhoto />);
    expect(screen.getByRole("button", { name: "Upload photo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
    unmount();

    signIn(photo);
    render(<ProfilePhoto />);
    expect(screen.getByRole("button", { name: "Change photo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("removes the photo", async () => {
    signIn(photo);
    render(<ProfilePhoto />);

    await user().click(screen.getByRole("button", { name: "Remove" }));

    expect(updateProfile).toHaveBeenCalledWith({ profileImage: null });
  });

  it("refuses a file that isn't an allowed image, without uploading", async () => {
    signIn(null);
    render(<ProfilePhoto />);

    await user().upload(screen.getByLabelText("Profile photo"), new File(["x"], "me.gif", { type: "image/gif" }));

    expect(screen.getByText("me.gif isn't a JPG, PNG or WebP image.")).toBeInTheDocument();
    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it("shows why the upload or save failed", async () => {
    signIn(null);
    mockedUpload.mockResolvedValue(uploaded);
    updateProfile.mockRejectedValue(new ApiError("You can only attach images you uploaded yourself, for this purpose", 403));
    render(<ProfilePhoto />);

    await user().upload(screen.getByLabelText("Profile photo"), png());

    expect(
      await screen.findByText("You can only attach images you uploaded yourself, for this purpose"),
    ).toBeInTheDocument();
  });

  it("disables the buttons while a photo is uploading", async () => {
    signIn(photo);
    let finish!: (value: typeof uploaded) => void;
    mockedUpload.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<ProfilePhoto />);

    await user().upload(screen.getByLabelText("Profile photo"), png());
    expect(screen.getByRole("button", { name: /Change photo/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove" })).toBeDisabled();

    await act(async () => finish(uploaded));
    expect(screen.getByRole("button", { name: "Remove" })).toBeEnabled();
  });
});
