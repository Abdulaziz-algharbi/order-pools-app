import { useState } from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImageUploader } from "@/components/domain/ImageUploader";
import { uploadImage } from "@/services/api";
import { ApiError } from "@/lib/http";
import type { UploadedImage } from "@/types/domain";

vi.mock("@/services/api", () => ({ uploadImage: vi.fn() }));
const mockedUpload = vi.mocked(uploadImage);

const image = (name: string): UploadedImage => ({
  publicId: `orderpools/dev/offers/u1/${name}`,
  version: 1,
  signature: "s",
});
const png = (name: string, size = 1000) => {
  const file = new File(["x"], name, { type: "image/png" });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

// An upload the test finishes (or fails) when it chooses to.
function deferredUpload() {
  let resolve!: (image: UploadedImage) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<UploadedImage>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

let latest: UploadedImage[] = [];
const uploadingChanges: boolean[] = [];

function Harness({ initial = [], max = 10 }: { initial?: UploadedImage[]; max?: number }) {
  const [images, setImages] = useState(initial);
  latest = images;
  return (
    <>
      <label htmlFor="images">Product images</label>
      <ImageUploader
        id="images"
        purpose="offer"
        max={max}
        value={images}
        onChange={setImages}
        onUploadingChange={(u) => uploadingChanges.push(u)}
      />
    </>
  );
}

const input = () => screen.getByLabelText("Product images") as HTMLInputElement;
const user = () => userEvent.setup({ applyAccept: false });

// Vitest's own createObjectURL shim can't read jsdom's File; a browser's
// real one can. Stubbed here so previews (and their release) are visible.
const createObjectURL = vi.fn((file: File) => `blob:${file.name}`);
const revokeObjectURL = vi.fn();

beforeEach(() => {
  URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  mockedUpload.mockReset();
  latest = [];
  uploadingChanges.length = 0;
});

describe("ImageUploader", () => {
  it("uploads a picked file, showing progress, then adds it as the cover", async () => {
    const upload = deferredUpload();
    mockedUpload.mockReturnValue(upload.promise);
    render(<Harness />);

    await user().upload(input(), png("cover.png"));

    expect(mockedUpload).toHaveBeenCalledWith(
      expect.objectContaining({ name: "cover.png" }),
      "offer",
      expect.objectContaining({ onProgress: expect.any(Function) }),
    );
    expect(screen.getByLabelText("Uploading cover.png")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();

    await act(async () => upload.resolve(image("cover")));

    expect(latest).toEqual([image("cover")]);
    expect(screen.queryByLabelText("Uploading cover.png")).not.toBeInTheDocument();
    expect(screen.getByAltText("Image 1")).toHaveAttribute(
      "src",
      expect.stringContaining("/v1/orderpools/dev/offers/u1/cover"),
    );
    expect(screen.getByText("Cover")).toBeInTheDocument();
    // The local preview shown while uploading is released.
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:cover.png");
  });

  it("reports uploading while any upload runs, so a form can hold its submit", async () => {
    const upload = deferredUpload();
    mockedUpload.mockReturnValue(upload.promise);
    render(<Harness />);

    await user().upload(input(), png("a.png"));
    expect(uploadingChanges.at(-1)).toBe(true);

    await act(async () => upload.resolve(image("a")));
    expect(uploadingChanges.at(-1)).toBe(false);
  });

  it("shows upload progress as it's reported", async () => {
    const upload = deferredUpload();
    let report!: (fraction: number) => void;
    mockedUpload.mockImplementation((_file, _purpose, options) => {
      report = options!.onProgress!;
      return upload.promise;
    });
    render(<Harness />);

    await user().upload(input(), png("a.png"));
    act(() => report(0.4));

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
  });

  // Each finished upload adds itself to the latest list, not to a stale copy.
  it("keeps every image when uploads finish together", async () => {
    const first = deferredUpload();
    const second = deferredUpload();
    mockedUpload.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    render(<Harness />);

    await user().upload(input(), [png("a.png"), png("b.png")]);
    await act(async () => {
      second.resolve(image("b"));
      first.resolve(image("a"));
    });

    expect(latest.map((i) => i.publicId)).toEqual([image("b").publicId, image("a").publicId]);
  });

  it.each([
    ["a GIF", new File(["x"], "anim.gif", { type: "image/gif" }), "anim.gif isn't a JPG, PNG or WebP image."],
    ["a file over 5 MB", png("huge.png", 5 * 1024 * 1024 + 1), "huge.png is larger than 5 MB."],
  ])("refuses %s without uploading it", async (_label, file, message) => {
    render(<Harness />);

    await user().upload(input(), file);

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it("uploads only as many files as there are slots left, saying which were left out", async () => {
    mockedUpload.mockReturnValue(new Promise(() => {}));
    render(<Harness initial={[image("existing")]} max={2} />);

    await user().upload(input(), [png("a.png"), png("b.png")]);

    expect(mockedUpload).toHaveBeenCalledTimes(1);
    expect(screen.getByText("b.png wasn't added — at most 2 images.")).toBeInTheDocument();
    expect(screen.getByText("2 of 2 · JPG, PNG or WebP, up to 5 MB each")).toBeInTheDocument();
  });

  it("disables adding once the limit is reached", () => {
    render(<Harness initial={[image("a"), image("b")]} max={2} />);

    expect(screen.getByRole("button", { name: "Add more images" })).toBeDisabled();
    expect(input()).toBeDisabled();
  });

  it("makes another image the cover by moving it first", async () => {
    render(<Harness initial={[image("a"), image("b"), image("c")]} />);

    await user().click(screen.getByRole("button", { name: "Set image 3 as cover" }));

    expect(latest.map((i) => i.publicId.split("/").pop())).toEqual(["c", "a", "b"]);
  });

  it("removes an image", async () => {
    render(<Harness initial={[image("a"), image("b")]} />);

    await user().click(screen.getByRole("button", { name: "Remove image 1" }));

    expect(latest).toEqual([image("b")]);
    expect(screen.getByText("Cover")).toBeInTheDocument();
  });

  it("shows why an upload failed, frees its slot, and can be dismissed", async () => {
    const upload = deferredUpload();
    mockedUpload.mockReturnValue(upload.promise);
    render(<Harness max={1} />);

    await user().upload(input(), png("a.png"));
    await act(async () =>
      upload.reject(new ApiError("The image couldn't be uploaded: Invalid image file", 400)),
    );

    const failed = screen.getByLabelText("a.png failed");
    expect(within(failed).getByText("The image couldn't be uploaded: Invalid image file")).toBeInTheDocument();
    expect(latest).toEqual([]);
    expect(input()).toBeEnabled();
    expect(uploadingChanges.at(-1)).toBe(false);

    await user().click(screen.getByRole("button", { name: "Dismiss a.png" }));
    expect(screen.queryByLabelText("a.png failed")).not.toBeInTheDocument();
  });

  it("cancels uploads still running when it goes away", async () => {
    let signal: AbortSignal | undefined;
    mockedUpload.mockImplementation((_file, _purpose, options) => {
      signal = options?.signal;
      return new Promise(() => {});
    });
    const { unmount } = render(<Harness />);

    await user().upload(input(), png("a.png"));
    unmount();

    expect(signal?.aborted).toBe(true);
  });
});
