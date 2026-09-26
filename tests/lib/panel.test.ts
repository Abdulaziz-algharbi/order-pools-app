import { afterEach, describe, expect, it } from "vitest";
import { activePanel, defaultPanelFor, panelsFor, rememberPanel } from "@/lib/panel";
import { makeUser } from "../fixtures/auth";

afterEach(() => {
  localStorage.clear();
});

describe("lib/panel", () => {
  const dualRole = makeUser({ roles: ["RETAILER", "SUPPLIER"] });

  it("lists every panel a user can open, in priority order", () => {
    expect(panelsFor(dualRole)).toEqual(["supplier", "retailer"]);
    expect(panelsFor(makeUser())).toEqual(["retailer"]);
  });

  it("falls back to priority order when no panel was remembered", () => {
    expect(defaultPanelFor(dualRole)).toBe("supplier");
  });

  it("opens the panel the user last used", () => {
    rememberPanel(dualRole._id, "retailer");
    expect(defaultPanelFor(dualRole)).toBe("retailer");
  });

  it("keeps each account's remembered panel separate on a shared browser", () => {
    rememberPanel("someone-else", "retailer");
    expect(defaultPanelFor(dualRole)).toBe("supplier");
  });

  it("ignores a remembered panel the user no longer holds", () => {
    const retailerOnly = makeUser({ roles: ["RETAILER"] });
    rememberPanel(retailerOnly._id, "supplier");
    expect(defaultPanelFor(retailerOnly)).toBe("retailer");
  });

  it("ignores a garbage remembered value", () => {
    localStorage.setItem(`orderpools.lastPanel.${dualRole._id}`, "toString");
    expect(defaultPanelFor(dualRole)).toBe("supplier");
  });

  it("reads the active panel from the URL", () => {
    expect(activePanel("/supplier/pools/123")).toBe("supplier");
    expect(activePanel("/retailer")).toBe("retailer");
    expect(activePanel("/login")).toBeNull();
    expect(activePanel("/")).toBeNull();
  });
});
