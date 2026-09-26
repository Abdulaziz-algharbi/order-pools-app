import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "@/lib/http";
import { getPool, listDeliveries, listNotifications, listPools } from "@/services/api";

vi.mock("@/lib/http", () => ({ request: vi.fn() }));

const mockedRequest = vi.mocked(request);

beforeEach(() => {
  mockedRequest.mockReset();
  mockedRequest.mockResolvedValue({ message: "ok", data: [] });
});

afterEach(() => {
  window.history.pushState({}, "", "/");
});

describe("services/api — panel scoping (?as=)", () => {
  it.each([
    ["/supplier/pools", "SUPPLIER"],
    ["/retailer", "RETAILER"],
    ["/admin/track", "ADMIN"],
  ])("on %s, scopes pools/deliveries/notifications to %s", async (path, role) => {
    window.history.pushState({}, "", path);

    await listPools();
    await listDeliveries();
    await listNotifications();
    await getPool("p1");

    expect(mockedRequest).toHaveBeenCalledWith("/pools", { query: { as: role } });
    expect(mockedRequest).toHaveBeenCalledWith("/deliveries", { query: { as: role } });
    expect(mockedRequest).toHaveBeenCalledWith("/notifications", { query: { as: role } });
    expect(mockedRequest).toHaveBeenCalledWith("/pools/p1", { query: { as: role } });
  });

  it("sends no scope outside a panel", async () => {
    window.history.pushState({}, "", "/payments/x/result");

    await listPools();

    expect(mockedRequest).toHaveBeenCalledWith("/pools", { query: {} });
  });
});
