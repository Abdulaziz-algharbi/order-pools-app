import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "@/config/nav";

describe("NAV_ITEMS", () => {
  it.each(["retailer", "supplier", "admin"] as const)("links the %s panel to its profile page", (panel) => {
    expect(NAV_ITEMS[panel].map((item) => item.to)).toContain(`/${panel}/profile`);
  });
});
