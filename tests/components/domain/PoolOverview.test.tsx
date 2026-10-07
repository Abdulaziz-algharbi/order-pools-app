import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PoolOverview } from "@/components/domain/PoolOverview";
import { makePool } from "../../fixtures/pools";

const image = (name: string) => ({ publicId: `orderpools/dev/offers/s1/${name}`, version: 1 });

// PoolOverview is the shared detail layout for the retailer, supplier and
// admin pool pages, so all three get the gallery from here.
describe("PoolOverview images", () => {
  it("shows every product image, starting with the cover", async () => {
    render(<PoolOverview pool={makePool({ productImages: [image("cover"), image("side"), image("back")] })} />);

    expect(screen.getByAltText("Basmati Rice 25kg, image 1 of 3")).toHaveAttribute(
      "src",
      expect.stringContaining("/orderpools/dev/offers/s1/cover"),
    );
    expect(screen.getAllByRole("button", { name: /Show image \d of 3/ })).toHaveLength(3);

    await userEvent.click(screen.getByRole("button", { name: "Show image 2 of 3" }));
    expect(screen.getByAltText("Basmati Rice 25kg, image 2 of 3")).toHaveAttribute(
      "src",
      expect.stringContaining("/side"),
    );
  });

  it("shows no gallery for a pool without images", () => {
    render(<PoolOverview pool={makePool({ productImages: [] })} />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Premium long grain")).toBeInTheDocument();
  });
});

describe("PoolOverview pricing", () => {
  it("shows the price per lot and the lot size", () => {
    render(<PoolOverview pool={makePool({ minimumContribution: 25, minimumContributionPrice: 300, unit: "BOX" })} />);

    expect(screen.getByText("Price per lot")).toBeInTheDocument();
    expect(screen.getByText("300.000 OMR")).toBeInTheDocument();
    expect(screen.getByText("25 box")).toBeInTheDocument();
    expect(screen.queryByText("Locked once the pool exists")).not.toBeInTheDocument();
  });

  // The admin's view: the backend refuses any change to a pool's pricing.
  it("says the pricing is locked when asked to", () => {
    render(<PoolOverview pool={makePool()} pricingLocked />);

    expect(screen.getByText("Locked once the pool exists")).toBeInTheDocument();
  });
});
