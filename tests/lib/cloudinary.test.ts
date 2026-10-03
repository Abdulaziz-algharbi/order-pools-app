import { describe, expect, it } from "vitest";
import { IMAGE_PRESETS, MAX_IMAGE_BYTES, cldUrl, imageFileError } from "@/lib/cloudinary";

const image = { publicId: "orderpools/dev/offers/u1/cover", version: 1712345678 };

describe("cldUrl", () => {
  it("builds a delivery URL with the preset, automatic format/quality and the version", () => {
    expect(cldUrl(image, "card")).toBe(
      "https://res.cloudinary.com/test-cloud/image/upload/c_fill,w_640,h_400,f_auto,q_auto/v1712345678/orderpools/dev/offers/u1/cover",
    );
  });

  it.each(Object.keys(IMAGE_PRESETS) as (keyof typeof IMAGE_PRESETS)[])(
    "uses the %s preset's transformation",
    (preset) => {
      expect(cldUrl(image, preset)).toContain(`/image/upload/${IMAGE_PRESETS[preset]},f_auto,q_auto/`);
    },
  );

  // A re-upload gets a new version, so the CDN can't serve the old copy.
  it("changes when the version changes", () => {
    expect(cldUrl({ ...image, version: 2 }, "thumb")).not.toBe(cldUrl(image, "thumb"));
  });
});

describe("imageFileError", () => {
  const file = (type: string, size = 1000) => {
    const f = new File(["x"], "photo", { type });
    Object.defineProperty(f, "size", { value: size });
    return f;
  };

  it.each(["image/jpeg", "image/png", "image/webp"])("accepts %s", (type) => {
    expect(imageFileError(file(type))).toBeNull();
  });

  it.each(["image/gif", "image/svg+xml", "application/pdf", ""])("refuses %s", (type) => {
    expect(imageFileError(file(type))).toBe("photo isn't a JPG, PNG or WebP image.");
  });

  it("accepts exactly 5 MB and refuses more", () => {
    expect(MAX_IMAGE_BYTES).toBe(5 * 1024 * 1024);
    expect(imageFileError(file("image/png", MAX_IMAGE_BYTES))).toBeNull();
    expect(imageFileError(file("image/png", MAX_IMAGE_BYTES + 1))).toBe("photo is larger than 5 MB.");
  });
});

