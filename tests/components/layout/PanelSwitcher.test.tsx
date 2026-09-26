import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PanelSwitcher } from "@/components/layout/PanelSwitcher";
import { useAuth } from "@/context/AuthContext";
import { authValue, makeUser } from "../../fixtures/auth";

vi.mock("@/context/AuthContext", () => ({ useAuth: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);

function renderAt(path: string, roles: ("RETAILER" | "SUPPLIER" | "ADMIN")[]) {
  mockedUseAuth.mockReturnValue(authValue(makeUser({ roles })));
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/retailer" element={<PanelSwitcher current="retailer" />} />
        <Route path="/supplier" element={<p>supplier dashboard</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("PanelSwitcher", () => {
  it("is hidden for a single-panel account", () => {
    renderAt("/retailer", ["RETAILER"]);

    expect(screen.queryByRole("group", { name: "Switch panel" })).not.toBeInTheDocument();
  });

  it("marks the current panel and switches to the other one's dashboard", async () => {
    renderAt("/retailer", ["RETAILER", "SUPPLIER"]);

    expect(screen.getByRole("button", { name: "Retailer" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Supplier" }));

    expect(screen.getByText("supplier dashboard")).toBeInTheDocument();
  });
});
