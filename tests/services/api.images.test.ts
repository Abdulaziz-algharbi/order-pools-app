import { beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "@/lib/http";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { getUploadSignature, uploadImage } from "@/services/api";

vi.mock("@/lib/http", () => ({ request: vi.fn() }));
vi.mock("@/lib/cloudinary", () => ({ uploadToCloudinary: vi.fn() }));

const mockedRequest = vi.mocked(request);
const mockedUpload = vi.mocked(uploadToCloudinary);

const signed = {
  uploadUrl: "https://api.cloudinary.com/v1_1/test-cloud/image/upload",
  cloudName: "test-cloud",
  apiKey: "k",
  timestamp: 1,
  signature: "s",
  params: { folder: "orderpools/dev/offers/u1" },
};

beforeEach(() => {
  mockedRequest.mockReset();
  mockedUpload.mockReset();
  mockedRequest.mockResolvedValue(signed);
});

describe("services/api — getUploadSignature", () => {
  it.each([
    ["offer", "/uploads/offer-image/signature"],
    ["profile", "/uploads/profile-image/signature"],
  ] as const)("asks the backend to sign a %s image upload", async (purpose, path) => {
    await expect(getUploadSignature(purpose)).resolves.toEqual(signed);
    expect(mockedRequest).toHaveBeenCalledWith(path, { method: "POST" });
  });
});

describe("services/api — uploadImage", () => {
  it("signs, then uploads the file with that signature", async () => {
    const uploaded = { publicId: "p", version: 1, signature: "cloudinary" };
    mockedUpload.mockResolvedValue(uploaded);
    const file = new File(["x"], "a.png", { type: "image/png" });
    const onProgress = vi.fn();

    await expect(uploadImage(file, "offer", { onProgress })).resolves.toEqual(uploaded);

    expect(mockedRequest).toHaveBeenCalledWith("/uploads/offer-image/signature", { method: "POST" });
    expect(mockedUpload).toHaveBeenCalledWith(signed, file, { onProgress });
  });

  it("doesn't upload when the backend refuses to sign", async () => {
    mockedRequest.mockRejectedValue(new Error("Please verify your email address"));

    await expect(uploadImage(new File(["x"], "a.png"), "offer")).rejects.toThrow("verify your email");
    expect(mockedUpload).not.toHaveBeenCalled();
  });
});
