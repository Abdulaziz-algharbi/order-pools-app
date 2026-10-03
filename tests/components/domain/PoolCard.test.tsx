import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PoolCard } from "@/components/domain/PoolCard";
import { makePool } from "../../fixtures/pools";

const image = (name: string) => ({ publicId: `orderpools/dev/offers/s1/${name}`, version: 7 });

describe("PoolCard cover image", () => {
  it("shows the first image as the cover, at card size", () => {
    render(<PoolCard pool={makePool({ productImages: [image("cover"), image("side")] })} />);

    const cover = screen.getByAltText("Basmati Rice 25kg");
    expect(cover).toHaveAttribute(
      "src",
      "https://res.cloudinary.com/test-cloud/image/upload/c_fill,w_640,h_400,f_auto,q_auto/v7/orderpools/dev/offers/s1/cover",
    );
    expect(cover).toHaveAttribute("loading", "lazy");
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });

  it("shows a placeholder for a pool without images", () => {
    render(<PoolCard pool={makePool({ productImages: [] })} />);

    expect(screen.getByRole("img", { name: "No product image" })).toBeInTheDocument();
    expect(screen.queryByAltText("Basmati Rice 25kg")).not.toBeInTheDocument();
  });
});
