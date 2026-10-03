import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ImageGallery } from "@/components/domain/ImageGallery";

const image = (name: string, version = 1) => ({ publicId: `orderpools/dev/offers/u1/${name}`, version });

describe("ImageGallery", () => {
  it("renders nothing without images", () => {
    const { container } = render(<ImageGallery images={[]} name="Rice" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows a single image large, with no thumbnails", () => {
    render(<ImageGallery images={[image("cover")]} name="Rice" />);

    const main = screen.getByAltText("Rice");
    expect(main).toHaveAttribute("src", expect.stringContaining("c_limit,w_1600,h_1600"));
    expect(main).toHaveAttribute("src", expect.stringContaining("/orderpools/dev/offers/u1/cover"));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("starts on the cover and switches when a thumbnail is clicked", async () => {
    render(<ImageGallery images={[image("cover"), image("side"), image("back")]} name="Rice" />);

    expect(screen.getByAltText("Rice, image 1 of 3")).toHaveAttribute("src", expect.stringContaining("/cover"));
    expect(screen.getByRole("button", { name: "Show image 1 of 3" })).toHaveAttribute("aria-current", "true");

    await userEvent.click(screen.getByRole("button", { name: "Show image 3 of 3" }));

    expect(screen.getByAltText("Rice, image 3 of 3")).toHaveAttribute("src", expect.stringContaining("/back"));
    expect(screen.getByRole("button", { name: "Show image 3 of 3" })).toHaveAttribute("aria-current", "true");
  });

  it("falls back to the last image if the list shrinks below the selected one", async () => {
    const { rerender } = render(<ImageGallery images={[image("a"), image("b"), image("c")]} name="Rice" />);
    await userEvent.click(screen.getByRole("button", { name: "Show image 3 of 3" }));

    rerender(<ImageGallery images={[image("a"), image("b")]} name="Rice" />);

    expect(screen.getByAltText("Rice, image 2 of 2")).toHaveAttribute("src", expect.stringContaining("/b"));
  });
});
