import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "@/components/domain/Avatar";

describe("Avatar", () => {
  it("shows the profile photo at avatar size", () => {
    render(
      <Avatar
        user={{ firstName: "Aisha", lastName: "Said", profileImage: { publicId: "orderpools/dev/profiles/u1/me", version: 3 } }}
      />,
    );

    expect(screen.getByRole("img", { name: "Aisha Said" })).toHaveAttribute(
      "src",
      expect.stringContaining("c_fill,g_auto,w_256,h_256,f_auto,q_auto/v3/orderpools/dev/profiles/u1/me"),
    );
  });

  it("shows the initials without a photo", () => {
    render(<Avatar user={{ firstName: "aisha", lastName: "said", profileImage: null }} />);

    const avatar = screen.getByRole("img", { name: "aisha said" });
    expect(avatar).toHaveTextContent("AS");
  });

  it("copes with a blank name", () => {
    render(<Avatar user={{ firstName: " ", lastName: "", profileImage: null }} />);

    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("can be hidden from screen readers where the name is shown beside it", () => {
    const { container, rerender } = render(
      <Avatar user={{ firstName: "Aisha", lastName: "Said", profileImage: null }} decorative />,
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");

    rerender(
      <Avatar
        user={{ firstName: "Aisha", lastName: "Said", profileImage: { publicId: "p", version: 1 } }}
        decorative
      />,
    );
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });
});
