// @vitest-environment node
// Under jsdom, MSW can't read jsdom's FormData (a known incompatibility),
// so the upload is tested with Node's own FormData/File and axios's Node
// adapter.
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/http";
import { uploadToCloudinary, type SignedUpload } from "@/lib/cloudinary";

describe("uploadToCloudinary", () => {
  const UPLOAD_URL = "https://api.cloudinary.com/v1_1/test-cloud/image/upload";
  const signed: SignedUpload = {
    uploadUrl: UPLOAD_URL,
    cloudName: "test-cloud",
    apiKey: "123456789012345",
    timestamp: 1700000000,
    signature: "server-signature",
    params: {
      folder: "orderpools/dev/offers/u1",
      allowed_formats: "jpg,png,webp",
      transformation: "c_limit,w_2000,h_2000",
    },
  };
  const file = new File(["png-bytes"], "cover.png", { type: "image/png" });

  const server = setupServer();
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it("sends the file with every signed parameter unchanged", async () => {
    let sent: FormData | undefined;
    server.use(
      http.post(UPLOAD_URL, async ({ request }) => {
        sent = await request.formData();
        return HttpResponse.json({ public_id: "p", version: 1, signature: "s" });
      }),
    );

    await uploadToCloudinary(signed, file);

    expect(sent?.get("folder")).toBe("orderpools/dev/offers/u1");
    expect(sent?.get("allowed_formats")).toBe("jpg,png,webp");
    expect(sent?.get("transformation")).toBe("c_limit,w_2000,h_2000");
    expect(sent?.get("timestamp")).toBe("1700000000");
    expect(sent?.get("api_key")).toBe("123456789012345");
    expect(sent?.get("signature")).toBe("server-signature");
    expect((sent?.get("file") as File).name).toBe("cover.png");
  });

  // Cloudinary is a third party: our session and CSRF token must never
  // go to it.
  it("sends no cookie, CSRF or authorization header", async () => {
    let headers: Headers | undefined;
    server.use(
      http.post(UPLOAD_URL, ({ request }) => {
        headers = request.headers;
        return HttpResponse.json({ public_id: "p", version: 1, signature: "s" });
      }),
    );

    await uploadToCloudinary(signed, file);

    expect(headers?.get("cookie")).toBeNull();
    expect(headers?.get("x-xsrf-token")).toBeNull();
    expect(headers?.get("authorization")).toBeNull();
  });

  it("returns the upload ready to attach, with its signature and size", async () => {
    server.use(
      http.post(UPLOAD_URL, () =>
        HttpResponse.json({
          public_id: "orderpools/dev/offers/u1/abc",
          version: 1712345678,
          signature: "cloudinary-signature",
          width: 1200,
          height: 800,
          secure_url: "https://res.cloudinary.com/...",
        }),
      ),
    );

    await expect(uploadToCloudinary(signed, file)).resolves.toEqual({
      publicId: "orderpools/dev/offers/u1/abc",
      version: 1712345678,
      signature: "cloudinary-signature",
      width: 1200,
      height: 800,
    });
  });

  it("surfaces Cloudinary's own reason when it refuses the upload", async () => {
    server.use(
      http.post(UPLOAD_URL, () =>
        HttpResponse.json({ error: { message: "Image file format gif not allowed" } }, { status: 400 }),
      ),
    );

    const error = await uploadToCloudinary(signed, file).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.message).toBe("The image couldn't be uploaded: Image file format gif not allowed");
  });

  it("gives a generic message when Cloudinary can't be reached", async () => {
    server.use(http.post(UPLOAD_URL, () => HttpResponse.error()));

    const error = await uploadToCloudinary(signed, file).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe("The image couldn't be uploaded. Please try again.");
  });
});
