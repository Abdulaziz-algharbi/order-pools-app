import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ApiError, request } from "@/lib/http";

const API = "http://api.test/api/v1";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  clearCookies();
});
afterAll(() => server.close());

function clearCookies() {
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0].trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

describe("request() — cookie-based auth", () => {
  it("sends requests with credentials so the browser attaches the httpOnly auth cookies", async () => {
    let credentials: RequestCredentials | undefined;
    server.use(
      http.get(`${API}/auth/me`, ({ request }) => {
        credentials = request.credentials;
        return HttpResponse.json({ user: { _id: "u1" } });
      }),
    );

    await request("/auth/me");

    expect(credentials).toBe("include");
  });

  it("never sends an Authorization header — there is no client-side token any more", async () => {
    let authorization: string | null = "unset";
    server.use(
      http.get(`${API}/auth/me`, ({ request }) => {
        authorization = request.headers.get("authorization");
        return HttpResponse.json({ user: { _id: "u1" } });
      }),
    );

    await request("/auth/me");

    expect(authorization).toBeNull();
  });

  it("echoes the XSRF-TOKEN cookie as the X-XSRF-TOKEN header on a cross-origin mutation", async () => {
    document.cookie = "XSRF-TOKEN=csrf-abc; path=/";
    let header: string | null = null;
    server.use(
      http.post(`${API}/addresses`, ({ request }) => {
        header = request.headers.get("x-xsrf-token");
        return HttpResponse.json({ _id: "a1" }, { status: 201 });
      }),
    );

    await request("/addresses", { method: "POST", body: { city: "Muscat" } });

    expect(header).toBe("csrf-abc");
  });

  it("does not store anything in localStorage", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    server.use(http.post(`${API}/auth/login`, () => HttpResponse.json({ message: "ok" })));

    await request("/auth/login", {
      method: "POST",
      body: { email: "a@b.c", password: "x" },
      auth: false,
    });

    expect(setItem).not.toHaveBeenCalled();
  });
});

describe("request() — request/response shape", () => {
  it("sends a JSON body and returns the response body unchanged", async () => {
    let received: unknown;
    server.use(
      http.post(`${API}/pools`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ _id: "p1", raw: true }, { status: 201 });
      }),
    );

    const res = await request("/pools", { method: "POST", body: { quantity: 3 } });

    expect(received).toEqual({ quantity: 3 });
    expect(res).toEqual({ _id: "p1", raw: true });
  });

  it("serializes query params and drops undefined values", async () => {
    let search = "";
    server.use(
      http.get(`${API}/pools`, ({ request }) => {
        search = new URL(request.url).search;
        return HttpResponse.json({ message: "ok", data: [] });
      }),
    );

    await request("/pools", { query: { status: "OPEN", page: 2, supplier: undefined } });

    const params = new URLSearchParams(search);
    expect(params.get("status")).toBe("OPEN");
    expect(params.get("page")).toBe("2");
    expect(params.has("supplier")).toBe(false);
  });

  it("maps a backend error body to an ApiError with its real message, status and errors", async () => {
    server.use(
      http.post(`${API}/auth/register`, () =>
        HttpResponse.json(
          { message: "Email already registered", errors: [{ path: "email" }] },
          { status: 409 },
        ),
      ),
    );

    const error = await request("/auth/register", {
      method: "POST",
      body: {},
      auth: false,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      message: "Email already registered",
      status: 409,
      errors: [{ path: "email" }],
    });
  });

  it("maps a network failure to an ApiError with status 0", async () => {
    server.use(http.get(`${API}/pools`, () => HttpResponse.error()));

    const error = await request("/pools").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
  });
});

describe("request() — silent refresh on 401", () => {
  it("refreshes via the refresh cookie and retries the original request once", async () => {
    let meCalls = 0;
    let refreshBody: string | null = "unset";
    server.use(
      http.get(`${API}/auth/me`, () => {
        meCalls += 1;
        return meCalls === 1
          ? HttpResponse.json({ message: "Access token expired" }, { status: 401 })
          : HttpResponse.json({ user: { _id: "u1" } });
      }),
      http.post(`${API}/auth/refresh`, async ({ request }) => {
        // No token in the body — the refresh token is the httpOnly cookie.
        refreshBody = await request.text();
        return HttpResponse.json({ message: "Token refreshed" });
      }),
    );

    const res = await request<{ user: { _id: string } }>("/auth/me");

    expect(res.user._id).toBe("u1");
    expect(meCalls).toBe(2);
    expect(refreshBody).toBe("");
  });

  it("uses the rotated XSRF-TOKEN cookie on the retried mutation", async () => {
    document.cookie = "XSRF-TOKEN=old; path=/";
    const headers: (string | null)[] = [];
    server.use(
      http.patch(`${API}/auth/me`, ({ request }) => {
        headers.push(request.headers.get("x-xsrf-token"));
        return headers.length === 1
          ? HttpResponse.json({ message: "expired" }, { status: 401 })
          : HttpResponse.json({ message: "ok", user: { _id: "u1" } });
      }),
      http.post(`${API}/auth/refresh`, () => {
        // Stands in for the backend's Set-Cookie on refresh (setAuthCookies
        // issues a fresh CSRF token alongside the new access token).
        document.cookie = "XSRF-TOKEN=new; path=/";
        return HttpResponse.json({ message: "Token refreshed" });
      }),
    );

    await request("/auth/me", { method: "PATCH", body: { firstName: "A" } });

    expect(headers).toEqual(["old", "new"]);
  });

  it("shares one in-flight refresh across concurrent 401s", async () => {
    let refreshCalls = 0;
    const seen = new Set<string>();
    server.use(
      http.get(`${API}/:resource`, ({ params }) => {
        const resource = String(params.resource);
        if (!seen.has(resource)) {
          seen.add(resource);
          return HttpResponse.json({ message: "expired" }, { status: 401 });
        }
        return HttpResponse.json({ resource });
      }),
      http.post(`${API}/auth/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json({ message: "Token refreshed" });
      }),
    );

    const results = await Promise.all([
      request<{ resource: string }>("/pools"),
      request<{ resource: string }>("/payments"),
      request<{ resource: string }>("/notifications"),
    ]);

    expect(results.map((r) => r.resource)).toEqual(["pools", "payments", "notifications"]);
    expect(refreshCalls).toBe(1);
  });

  it("signals session expiry and throws the original 401 when the refresh fails", async () => {
    const onExpired = vi.fn();
    window.addEventListener("order-pool:session-expired", onExpired);
    server.use(
      http.get(`${API}/auth/me`, () =>
        HttpResponse.json({ message: "Access token is missing" }, { status: 401 }),
      ),
      http.post(`${API}/auth/refresh`, () =>
        HttpResponse.json({ message: "Refresh token is missing" }, { status: 401 }),
      ),
    );

    const error = await request("/auth/me").catch((e: unknown) => e);
    window.removeEventListener("order-pool:session-expired", onExpired);

    expect(error).toMatchObject({ status: 401, message: "Access token is missing" });
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it("does not attempt a refresh for auth: false requests", async () => {
    const refresh = vi.fn(() => HttpResponse.json({ message: "Token refreshed" }));
    const onExpired = vi.fn();
    window.addEventListener("order-pool:session-expired", onExpired);
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({ message: "Invalid email or password" }, { status: 401 }),
      ),
      http.post(`${API}/auth/refresh`, refresh),
    );

    const error = await request("/auth/login", {
      method: "POST",
      body: { email: "a@b.c", password: "wrong" },
      auth: false,
    }).catch((e: unknown) => e);
    window.removeEventListener("order-pool:session-expired", onExpired);

    expect(error).toMatchObject({ status: 401, message: "Invalid email or password" });
    expect(refresh).not.toHaveBeenCalled();
    expect(onExpired).not.toHaveBeenCalled();
  });

  it("does not refresh on non-401 errors", async () => {
    const refresh = vi.fn(() => HttpResponse.json({ message: "Token refreshed" }));
    server.use(
      http.get(`${API}/admin/users`, () =>
        HttpResponse.json({ message: "Forbidden" }, { status: 403 }),
      ),
      http.post(`${API}/auth/refresh`, refresh),
    );

    const error = await request("/admin/users").catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 403, message: "Forbidden" });
    expect(refresh).not.toHaveBeenCalled();
  });
});
