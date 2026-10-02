import { describe, expect, it } from "vitest";
import { IMAGE_PRESETS, cldUrl } from "@/lib/cloudinary";

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
